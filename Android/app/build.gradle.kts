plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.kotlin.serialization)
}

android {
    namespace = "com.crustandco.customer"
    compileSdk {
        version = release(37)
    }

    defaultConfig {
        applicationId = "com.crustandco.customer"
        minSdk = 26
        targetSdk = 37
        versionCode = 1
        versionName = "0.1.0"
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"

        // Base URL of the Next.js API. Must end with "/". 10.0.2.2 is the host machine as seen from the Android emulator.
        // Override per machine in ~/.gradle/gradle.properties: crust.apiBaseUrl=http://192.168.x.x:3000/api/
        val apiBaseUrl = providers.gradleProperty("crust.apiBaseUrl").orElse("http://10.0.2.2:3000/api/").get()
        buildConfigField("String", "API_BASE_URL", "\"$apiBaseUrl\"")

        // true = in-memory demo data behind the same repository interfaces (no backend needed).
        // Flip with -Pcrust.useMockData=false once the Phase 3 API is stable.
        val useMock = providers.gradleProperty("crust.useMockData").orElse("true").get()
        buildConfigField("boolean", "USE_MOCK_DATA", useMock)

        // true = read the menu from the live API (crust.apiBaseUrl) while orders, addresses and offers stay demo data.
        // Run the dashboard's dev server first (npm run dev in backend/). Flip with -Pcrust.liveCatalog=true.
        val liveCatalog = providers.gradleProperty("crust.liveCatalog").orElse("false").get()
        buildConfigField("boolean", "LIVE_CATALOG", liveCatalog)

        // true = addresses, pricing, checkout and orders also go to the live API, as a guest identified by a private device token.
        // Implies the live menu (cart items must be real products). Flip with -Pcrust.liveOrders=true.
        val liveOrders = providers.gradleProperty("crust.liveOrders").orElse("false").get()
        buildConfigField("boolean", "LIVE_ORDERS", liveOrders)
    }

    buildTypes {
        // Release-like build for measuring speed on a device: shrunk and optimised like release, but signed with the
        // debug key so it installs. Never distribute it.
        create("benchmark") {
            initWith(getByName("release"))
            signingConfig = signingConfigs.getByName("debug")
            matchingFallbacks += "release"
            isDebuggable = false
        }
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }

    testOptions {
        unitTests.isReturnDefaultValues = true
    }
}

dependencies {
    implementation(platform(libs.androidx.compose.bom))
    implementation(libs.androidx.compose.ui)
    implementation(libs.androidx.compose.ui.graphics)
    implementation(libs.androidx.compose.ui.tooling.preview)
    implementation(libs.androidx.compose.material3)
    debugImplementation(libs.androidx.compose.ui.tooling)

    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.activity.compose)
    implementation(libs.androidx.lifecycle.runtime.compose)
    implementation(libs.androidx.lifecycle.viewmodel.compose)
    implementation(libs.androidx.navigation.compose)
    implementation(libs.kotlinx.coroutines.android)
    implementation(libs.kotlinx.serialization.json)

    implementation(libs.retrofit)
    implementation(libs.retrofit.converter.kotlinx.serialization)
    implementation(libs.okhttp)
    implementation(libs.okhttp.logging)

    implementation(libs.coil.compose)
    implementation(libs.coil.network.okhttp)

    testImplementation(libs.junit)
    testImplementation(libs.kotlinx.coroutines.test)
}
