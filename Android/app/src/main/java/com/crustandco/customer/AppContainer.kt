package com.crustandco.customer

import android.content.Context
import androidx.compose.runtime.staticCompositionLocalOf
import com.crustandco.customer.data.remote.ApiClient
import com.crustandco.customer.data.remote.AuthTokenProvider
import com.crustandco.customer.data.local.DemoAuthRepository
import com.crustandco.customer.data.local.InMemoryCartStore
import com.crustandco.customer.data.local.SharedPreferencesStore
import com.crustandco.customer.data.mock.MockAddressRepository
import com.crustandco.customer.data.mock.MockBackend
import com.crustandco.customer.data.mock.MockCatalogRepository
import com.crustandco.customer.data.mock.MockCheckoutRepository
import com.crustandco.customer.data.mock.MockPricingRepository
import com.crustandco.customer.data.mock.MockOrderRepository
import com.crustandco.customer.data.mock.MockPromotionRepository
import com.crustandco.customer.data.repository.RemoteCatalogRepository
import com.crustandco.customer.data.repository.UnavailableAddressRepository
import com.crustandco.customer.data.repository.UnavailableCheckoutRepository
import com.crustandco.customer.data.repository.UnavailablePricingRepository
import com.crustandco.customer.data.repository.RemoteOrderRepository
import com.crustandco.customer.data.repository.RemotePromotionRepository
import com.crustandco.customer.domain.AddressRepository
import com.crustandco.customer.domain.AuthRepository
import com.crustandco.customer.domain.CartStore
import com.crustandco.customer.domain.CheckoutRepository
import com.crustandco.customer.domain.PricingRepository
import com.crustandco.customer.domain.CatalogRepository
import com.crustandco.customer.domain.OrderRepository
import com.crustandco.customer.domain.PromotionRepository

data class AppConfig(
    val apiBaseUrl: String,
    val useMockData: Boolean,
    /** Menu from the live API while orders, addresses and offers stay demo data (until checkout is built on the server). */
    val liveCatalog: Boolean,
    val isDebug: Boolean,
) {
    companion object {
        fun fromBuildConfig() = AppConfig(
            apiBaseUrl = BuildConfig.API_BASE_URL,
            useMockData = BuildConfig.USE_MOCK_DATA,
            liveCatalog = BuildConfig.LIVE_CATALOG,
            isDebug = BuildConfig.DEBUG,
        )
    }
}

/**
 * Hand-written dependency container. Small enough that Hilt isn't justified yet; swap it in later without
 * touching ViewModels, since they only receive repository interfaces.
 * Chooses mock or real repositories in one place.
 */
class AppContainer(val config: AppConfig, context: Context) {
    private val appContext = context.applicationContext

    // Only built when real data is used, so mock mode never touches the network stack.
    private val apiClient by lazy {
        ApiClient(config.apiBaseUrl, AuthTokenProvider.NoToken, enableLogging = config.isDebug, cacheDir = appContext.cacheDir)
    }

    // Demo mode shares one in-memory "backend" so an order placed at checkout shows up in My Orders.
    private val mockBackend: MockBackend? = if (config.useMockData) MockBackend() else null

    val catalogRepository: CatalogRepository =
        if (config.useMockData && !config.liveCatalog) MockCatalogRepository() else RemoteCatalogRepository(api = { apiClient.api })

    val orderRepository: OrderRepository =
        if (mockBackend != null) com.crustandco.customer.data.mock.MockOrderRepository(mockBackend) else RemoteOrderRepository(apiClient.api)

    val addressRepository: AddressRepository =
        if (mockBackend != null) MockAddressRepository(mockBackend) else UnavailableAddressRepository()

    val pricingRepository: PricingRepository =
        if (mockBackend != null) MockPricingRepository(catalog = catalogRepository) else UnavailablePricingRepository()

    val checkoutRepository: CheckoutRepository =
        if (mockBackend != null) MockCheckoutRepository(mockBackend, catalog = catalogRepository) else UnavailableCheckoutRepository()

    val promotionRepository: PromotionRepository =
        if (config.useMockData) MockPromotionRepository() else RemotePromotionRepository()

    /** Debug/demo only: moves the newest active demo order to its next status, standing in for the restaurant dashboard. Null in live mode. */
    val advanceDemoOrder: (() -> Unit)? = mockBackend?.let { backend -> { backend.advanceNewestActive() } }

    /**
     * Sign-in. Demo account only for now; real Google sign-in replaces this once the OAuth client is configured.
     * The preferences hold a made-up profile and no secrets.
     */
    val authRepository: AuthRepository = DemoAuthRepository(SharedPreferencesStore(context.applicationContext), googleSignInAvailable = false)

    /** One cart for the whole app session. In memory only for now. */
    val cartStore: CartStore = InMemoryCartStore()

    /** Welcome screen is shown once per app launch. Persisting this (DataStore) comes with sign-in in Phase 2. */
    var welcomeSeen: Boolean = false
}

val LocalAppContainer = staticCompositionLocalOf<AppContainer> {
    error("AppContainer not provided. Wrap content in CompositionLocalProvider(LocalAppContainer provides ...).")
}
