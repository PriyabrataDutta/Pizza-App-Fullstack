import java.util.Properties

plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.kotlin.serialization)
}

// Release signing comes from keystore.properties (git-ignored), so no secret is ever in the repository. Without the file a release build
// is still produced but unsigned, and Android will not install it.
val keystoreProps = Properties().apply {
    val file = rootProject.file("keystore.properties")
    if (file.exists()) file.inputStream().use { load(it) }
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
        versionCode = 2
        versionName = "0.2.0"
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"

        // Base URL of the Next.js API. Must end with "/". Every build talks to the live production backend by default.
        // For a local dev server use -Pcrust.apiBaseUrl=http://10.0.2.2:3000/api/ (10.0.2.2 is the host as seen from the emulator),
        // or set it per machine in ~/.gradle/gradle.properties.
        val apiBaseUrl = providers.gradleProperty("crust.apiBaseUrl").orElse("https://pizza-app-fullstack-backend.vercel.app/api/").get()
        buildConfigField("String", "API_BASE_URL", "\"$apiBaseUrl\"")

        // true = in-memory demo data behind the same repository interfaces (no backend needed). Off by default: the app uses the live API.
        // Flip with -Pcrust.useMockData=true for an offline demo.
        val useMock = providers.gradleProperty("crust.useMockData").orElse("false").get()
        buildConfigField("boolean", "USE_MOCK_DATA", useMock)

        // true = read the menu (categories, products, images) from the live API (crust.apiBaseUrl). On by default.
        val liveCatalog = providers.gradleProperty("crust.liveCatalog").orElse("true").get()
        buildConfigField("boolean", "LIVE_CATALOG", liveCatalog)

        // true = addresses, pricing, checkout and orders also go to the live API, as a guest identified by a private device token.
        // Implies the live menu (cart items must be real products). On by default; -Pcrust.liveOrders=false keeps orders demo-only.
        val liveOrders = providers.gradleProperty("crust.liveOrders").orElse("true").get()
        buildConfigField("boolean", "LIVE_ORDERS", liveOrders)
    }

    signingConfigs {
        if (keystoreProps.isNotEmpty()) {
            create("release") {
                storeFile = rootProject.file(keystoreProps.getProperty("storeFile"))
                storePassword = keystoreProps.getProperty("storePassword")
                keyAlias = keystoreProps.getProperty("keyAlias")
                keyPassword = keystoreProps.getProperty("keyPassword")
            }
        }
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
            // A release build is the production app by default, so "Build APK" in Android Studio needs no flags: real backend, no demo data.
            // Any of these can still be overridden with -Pcrust.* on the command line.
            buildConfigField("String", "API_BASE_URL", "\"${providers.gradleProperty("crust.apiBaseUrl").orElse("https://pizza-app-fullstack-backend.vercel.app/api/").get()}\"")
            buildConfigField("boolean", "USE_MOCK_DATA", providers.gradleProperty("crust.useMockData").orElse("false").get())
            buildConfigField("boolean", "LIVE_CATALOG", providers.gradleProperty("crust.liveCatalog").orElse("true").get())
            buildConfigField("boolean", "LIVE_ORDERS", providers.gradleProperty("crust.liveOrders").orElse("true").get())
            if (keystoreProps.isNotEmpty()) signingConfig = signingConfigs.getByName("release")
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
