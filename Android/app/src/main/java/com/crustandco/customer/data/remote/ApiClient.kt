package com.crustandco.customer.data.remote

import kotlinx.serialization.json.Json
import okhttp3.Cache
import okhttp3.CacheControl
import okhttp3.Interceptor
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.kotlinx.serialization.asConverterFactory
import java.io.File
import java.io.IOException
import java.util.concurrent.TimeUnit

/**
 * Supplies the signed-in user's Supabase access token (JWT) for the Authorization header.
 * Phase 1 has no sign-in, so [NoToken] is used. Phase 2 provides a real implementation.
 * Identity always comes from this token, never from a user ID in a request body (docs/security-and-rls.md).
 */
fun interface AuthTokenProvider {
    fun token(): String?

    object NoToken : AuthTokenProvider {
        override fun token(): String? = null
    }
}

/** Shared JSON settings. Unknown fields are ignored so additive backend changes don't break old app versions. */
val ApiJson: Json = Json {
    ignoreUnknownKeys = true
    explicitNulls = false
    coerceInputValues = true
}

private val CUSTOMER_PATHS = listOf("/addresses", "/pricing/", "/checkout", "/orders")

private fun String.isCustomerPath() = CUSTOMER_PATHS.any { contains(it) }

class ApiClient(
    baseUrl: String,
    tokenProvider: AuthTokenProvider,
    enableLogging: Boolean,
    /** Where to keep the HTTP cache. Null turns caching off (unit tests). */
    cacheDir: File? = null,
) {
    init {
        require(baseUrl.endsWith("/")) { "API base URL must end with '/': $baseUrl" }
    }

    private val authInterceptor = Interceptor { chain ->
        // The token goes only to the customer endpoints. Menu requests stay anonymous, so a shared cache can keep serving them to everyone.
        val token = if (chain.request().url.encodedPath.isCustomerPath()) tokenProvider.token() else null
        val request = if (token == null) {
            chain.request()
        } else {
            chain.request().newBuilder().header("Authorization", "Bearer $token").build()
        }
        chain.proceed(request)
    }

    /**
     * Menu responses carry an ETag and a short max-age, so OkHttp's cache answers repeat requests instantly and revalidates with
     * a 304 afterwards. When the phone is offline a GET falls back to whatever is cached, up to a week old.
     */
    private val offlineFallback = Interceptor { chain ->
        try {
            chain.proceed(chain.request())
        } catch (offline: IOException) {
            if (chain.request().method != "GET") throw offline
            val cached = chain.proceed(
                chain.request().newBuilder().cacheControl(CacheControl.Builder().onlyIfCached().maxStale(7, TimeUnit.DAYS).build()).build(),
            )
            if (cached.code == 504) { // nothing cached
                cached.close()
                throw offline
            }
            cached
        }
    }

    private val okHttp: OkHttpClient = OkHttpClient.Builder()
        .apply { if (cacheDir != null) cache(Cache(File(cacheDir, "http"), 10L * 1024 * 1024)) }
        .addInterceptor(offlineFallback)
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(20, TimeUnit.SECONDS)
        .addInterceptor(authInterceptor)
        .apply {
            if (enableLogging) {
                // Headers and bodies are not logged: they carry tokens and personal data.
                addInterceptor(HttpLoggingInterceptor().apply { level = HttpLoggingInterceptor.Level.BASIC })
            }
        }
        .build()

    val api: CrustApi = Retrofit.Builder()
        .baseUrl(baseUrl)
        .client(okHttp)
        .addConverterFactory(ApiJson.asConverterFactory("application/json".toMediaType()))
        .build()
        .create(CrustApi::class.java)
}
