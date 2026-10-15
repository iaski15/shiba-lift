plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
}

android {
    namespace = "com.shibalift.wear"
    compileSdk = 36
    defaultConfig {
        // Must match the phone app's package and signing key, or Wear OS won't let them talk.
        applicationId = "com.shibalift.app"
        minSdk = 30 // Wear OS 3+ (Galaxy Watch 4 and newer)
        targetSdk = 36
        versionCode = 3
        versionName = "1.2.0"
    }
    signingConfigs {
        create("phone") {
            // The phone release APK is signed with the generated android/ project's debug.keystore (see scripts/build-apk.js).
            storeFile = file("../../android/app/debug.keystore")
            storePassword = "android"
            keyAlias = "androiddebugkey"
            keyPassword = "android"
        }
    }
    buildTypes {
        debug { signingConfig = signingConfigs.getByName("phone") }
        release {
            signingConfig = signingConfigs.getByName("phone")
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"))
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
    buildFeatures { compose = true }
}

dependencies {
    implementation("com.google.android.gms:play-services-wearable:20.0.1")
    implementation("androidx.activity:activity-compose:1.12.4")
    implementation("androidx.wear.compose:compose-material3:1.6.2")
    implementation("androidx.wear.compose:compose-foundation:1.6.2")
    implementation("androidx.wear:wear-ongoing:1.1.0")
}
