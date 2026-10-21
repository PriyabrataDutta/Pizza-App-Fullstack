package com.crustandco.customer

import android.app.Application
import coil3.ImageLoader
import coil3.SingletonImageLoader
import coil3.disk.DiskCache
import coil3.memory.MemoryCache
import coil3.request.crossfade
import okio.Path.Companion.toOkioPath

class CrustApp : Application() {
    lateinit var container: AppContainer
        private set

    override fun onCreate() {
        super.onCreate()
        container = AppContainer(AppConfig.fromBuildConfig(), applicationContext)
        // Pictures are downloaded once: a quarter of the app's memory for decoded ones and 64 MB on disk for the files, so scrolling
        // back and reopening the app show them instantly. Built on first use, not at startup.
        SingletonImageLoader.setSafe { context ->
            ImageLoader.Builder(context)
                .memoryCache { MemoryCache.Builder().maxSizePercent(context, 0.25).build() }
                .diskCache { DiskCache.Builder().directory(context.cacheDir.resolve("images").toOkioPath()).maxSizeBytes(64L * 1024 * 1024).build() }
                .crossfade(150)
                .build()
        }
    }
}
