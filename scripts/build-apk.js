// npm run build:apk → regenerates android/ from app.json, builds the release APK, copies it to release/ShibaLift.apk.
// Finds the Android SDK and a JDK 17/21 on its own when ANDROID_HOME / JAVA_HOME aren't set.
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const win = process.platform === 'win32';
const firstDir = (...dirs) => dirs.find(d => d && fs.existsSync(d));

const env = { ...process.env };
env.ANDROID_HOME ||= firstDir(
  env.ANDROID_SDK_ROOT,
  'D:/Android/Sdk',
  env.LOCALAPPDATA && path.join(env.LOCALAPPDATA, 'Android', 'Sdk'),
  env.HOME && path.join(env.HOME, 'Android', 'Sdk'),
  env.HOME && path.join(env.HOME, 'Library', 'Android', 'sdk'),
);
if (!env.ANDROID_HOME) throw new Error('Android SDK not found. Set ANDROID_HOME to your SDK folder.');

// Gradle/AGP want JDK 17 or 21; a newer default java (e.g. 25) can break the build.
if (!env.JAVA_HOME) {
  const javaRoot = win ? 'C:/Program Files/Java' : '/usr/lib/jvm';
  const jdk = fs.existsSync(javaRoot) && fs.readdirSync(javaRoot).filter(d => /(jdk-?|java-)(21|17)/.test(d)).sort().pop();
  if (jdk) env.JAVA_HOME = path.join(javaRoot, jdk);
}
console.log(`Android SDK: ${env.ANDROID_HOME}\nJDK: ${env.JAVA_HOME || '(java on PATH)'}`);

const run = (cmd, cwd = root) => execSync(cmd, { cwd, env, stdio: 'inherit' });
// Full path: some Windows setups won't run programs from the current folder.
const android = path.join(root, 'android');
const gradlew = path.join(android, win ? 'gradlew.bat' : 'gradlew');

// Regenerate android/ only when native config changed (app.json, packages, assets). Plain code changes skip this,
// which is faster and avoids deleting android/ while a build tool might still hold files in it.
const stampFile = path.join(android, '.prebuild-stamp');
const hash = require('crypto').createHash('sha1');
const files = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => (e.isDirectory() ? files(path.join(dir, e.name)) : [path.join(dir, e.name)]));
for (const f of ['app.json', 'package.json', ...files(path.join(root, 'assets')).map(f => path.relative(root, f))].sort()) {
  hash.update(f).update(fs.readFileSync(path.join(root, f)));
}
const stamp = hash.digest('hex');
if (!fs.existsSync(gradlew) || !fs.existsSync(stampFile) || fs.readFileSync(stampFile, 'utf8') !== stamp) {
  if (fs.existsSync(gradlew)) run(`"${gradlew}" --stop`, android); // release any leftover Gradle daemon's file locks
  run('npx expo prebuild --platform android');
  fs.writeFileSync(stampFile, stamp);
} else {
  console.log('Native config unchanged, skipping prebuild.');
}

// --no-daemon: nothing keeps running (and locking android/) after the build finishes.
run(`"${gradlew}" assembleRelease --no-daemon -PreactNativeArchitectures=arm64-v8a,armeabi-v7a,x86_64`, android);

const apk = path.join(root, 'android/app/build/outputs/apk/release/app-release.apk');
fs.mkdirSync(path.join(root, 'release'), { recursive: true });
fs.copyFileSync(apk, path.join(root, 'release/ShibaLift.apk'));
console.log('\n✅ release/ShibaLift.apk is ready. Copy it to your phone and open it to install.');
