package com.crustandco.customer

import android.app.Application
import coil3.ImageLoader
import coil3.SingletonImageLoader
import coil3.disk.DiskCache
import coil3.memory.MemoryCache
import coil3.request.ImageRequest
import coil3.request.crossfade
import com.crustandco.customer.core.AppResult
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import okio.Path.Companion.toOkioPath

class CrustApp : Application() {
    lateinit var container: AppContainer
        private set

    private val appScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

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
        warmUp()
    }

    /**
     * The customer spends a moment on the welcome screen. Meanwhile the menu is fetched into the shared in-memory copy and the first
     * pictures are queued, so Home opens with its content already there. Failures are ignored: the screens load normally if this missed.
     */
    private fun warmUp() {
        appScope.launch {
            val catalog = container.catalogRepository
            val categories = (catalog.categories() as? AppResult.Success)?.data.orEmpty()
            val popular = (catalog.products() as? AppResult.Success)?.data.orEmpty().filter { it.isBestseller }.take(PREFETCH_PRODUCTS)
            val urls = categories.mapNotNull { it.thumbUrl ?: it.imageUrl } + popular.mapNotNull { it.thumbUrl ?: it.imageUrl }
            val loader = SingletonImageLoader.get(applicationContext)
            urls.forEach { loader.enqueue(ImageRequest.Builder(applicationContext).data(it).build()) }
        }
    }

    private companion object {
        const val PREFETCH_PRODUCTS = 10
    }
}
