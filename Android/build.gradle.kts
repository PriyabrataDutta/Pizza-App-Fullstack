// Top-level build file. AGP 9 includes Kotlin support, so the kotlin-android plugin is intentionally not applied.
plugins {
    alias(libs.plugins.android.application) apply false
    alias(libs.plugins.kotlin.compose) apply false
    alias(libs.plugins.kotlin.serialization) apply false
}
