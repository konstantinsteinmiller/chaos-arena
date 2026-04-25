plugins {
    id("com.android.library")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.plugin.levelplay"
    compileSdk = 36

    defaultConfig {
        minSdk = 24
        consumerProguardFiles("proguard-rules.pro")
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_1_8
        targetCompatibility = JavaVersion.VERSION_1_8
    }

    kotlinOptions {
        jvmTarget = "1.8"
    }

    buildFeatures {
        buildConfig = true
    }
}

dependencies {
    // Tauri Android runtime — supplies app.tauri.plugin.{Plugin, Invoke,
    // JSObject} and the app.tauri.annotation.{TauriPlugin, Command,
    // InvokeArg} annotations the plugin's @TauriPlugin class is built
    // against. The subproject itself is registered automatically by the
    // Tauri CLI in tauri.settings.gradle.
    implementation(project(":tauri-android"))

    // ── LevelPlay mediation SDK ───────────────────────────────────────
    // Unity rebranded ironSource and moved all artifacts to Maven Central
    // under the `com.unity3d.ads-mediation` groupId. The old
    // `com.ironsource.sdk:mediationsdk` coordinate on android-sdk.is.com
    // was sunset on 2025-06-30 and no longer resolves. If a future bump
    // is needed, the current version is pinned in the Unity changelog
    // at docs.unity.com/en-us/grow/levelplay/sdk/android/changelog.
    implementation("com.unity3d.ads-mediation:mediation-sdk:9.4.0")

    // Required transitive Google Play Services dependencies. Versions
    // track what LevelPlay 9.4.0 is tested against per the Unity docs.
    implementation("com.google.android.gms:play-services-appset:16.0.0")
    implementation("com.google.android.gms:play-services-ads-identifier:18.1.0")
    implementation("com.google.android.gms:play-services-basement:18.1.0")

    // ── AdMob failsafe bidder ────────────────────────────────────────
    // Ships the adapter compiled into the APK so AdMob joins the bidding
    // pool the moment the dashboard credential is pasted in. The adapter
    // stays inert if AdMob is disabled on the dashboard, so leaving it
    // compiled in costs build size only.
    implementation("com.unity3d.ads-mediation:admob-adapter:5.4.0")
    implementation("com.google.android.gms:play-services-ads:24.9.0")

    // ── Unity Ads bidder ─────────────────────────────────────────────
    // Same parent company as LevelPlay (Unity owns the rebranded
    // ironSource), families-certified, integrates without a separate
    // SDK account. Strong default for any kids app on Android.
    implementation("com.unity3d.ads-mediation:unityads-adapter:5.5.0")
    implementation("com.unity3d.ads:unity-ads:4.16.6")

    // Other families-certified bidders — uncomment as we enable them in
    // the LevelPlay dashboard under Mediation → Networks. DO NOT add
    // Mintegral, Pangle, Vungle/Liftoff, or Chartboost: they are not
    // consistently certified for the Google Play Families Policy and
    // will block store review.
    //
    // implementation("com.unity3d.ads-mediation:applovin-adapter:<version>")
    // implementation("com.unity3d.ads-mediation:superawesome-adapter:<version>")

    implementation("androidx.appcompat:appcompat:1.7.1")
}
