package com.crustandco.customer.navigation

import androidx.compose.animation.AnimatedContentTransitionScope
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.EnterTransition
import androidx.compose.animation.ExitTransition
import androidx.compose.animation.ExperimentalSharedTransitionApi
import androidx.compose.animation.SharedTransitionLayout
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.navigation.NavBackStackEntry
import androidx.navigation.NavDestination.Companion.hasRoute
import androidx.navigation.NavDestination.Companion.hierarchy
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import androidx.navigation.toRoute
import com.crustandco.customer.LocalAppContainer
import com.crustandco.customer.core.LocalSnackbarHostState
import com.crustandco.customer.core.designsystem.LocalAnimatedScope
import com.crustandco.customer.core.designsystem.LocalSharedTransitionScope
import com.crustandco.customer.core.designsystem.Motion
import com.crustandco.customer.core.designsystem.Ph
import com.crustandco.customer.core.designsystem.components.BarItem
import com.crustandco.customer.core.designsystem.components.CrustBottomBar
import com.crustandco.customer.feature.account.SignInScreen
import com.crustandco.customer.feature.addresses.AddressesScreen
import com.crustandco.customer.feature.cart.CartScreen
import com.crustandco.customer.feature.cart.rememberCartCount
import com.crustandco.customer.feature.checkout.CheckoutScreen
import com.crustandco.customer.feature.home.HomeScreen
import com.crustandco.customer.feature.menu.MenuScreen
import com.crustandco.customer.feature.orders.OrdersScreen
import com.crustandco.customer.feature.product.ProductDetailScreen
import com.crustandco.customer.feature.profile.ProfileScreen
import com.crustandco.customer.feature.search.SearchScreen
import com.crustandco.customer.feature.tracking.TrackingScreen
import com.crustandco.customer.feature.welcome.WelcomeScreen
import kotlinx.serialization.Serializable

// Type-safe routes. The four tabs match the reference: Home, Menu, Cart, Profile.
@Serializable data object WelcomeRoute
@Serializable data object SignInRoute
@Serializable data object HomeRoute
@Serializable data class MenuRoute(val categoryId: String? = null)
@Serializable data object SearchRoute
@Serializable data object CartRoute
@Serializable data object ProfileRoute
@Serializable data class ProductRoute(val productId: String)
@Serializable data class CheckoutRoute(val couponCode: String? = null)
@Serializable data class TrackingRoute(val orderId: String)
@Serializable data object OrdersRoute
@Serializable data object AddressesRoute

private val TabRoutes: List<Any> = listOf(HomeRoute, MenuRoute(), SearchRoute, CartRoute, ProfileRoute)

// Motion for moving between screens. Tabs cross-fade with a tiny lift (they're siblings). Screens that open "on top" of
// something (a product, sign-in) rise from below and settle back down when closed.
private typealias Scope = AnimatedContentTransitionScope<NavBackStackEntry>

private val SoftEnter: Scope.() -> EnterTransition = {
    fadeIn(tween(Motion.Medium, easing = Motion.Enter)) + slideInVertically(tween(Motion.Medium, easing = Motion.Enter)) { it / 32 }
}
private val SoftExit: Scope.() -> ExitTransition = {
    fadeOut(tween(Motion.Fast, easing = Motion.Exit))
}
private val RiseEnter: Scope.() -> EnterTransition = {
    slideInVertically(tween(Motion.Medium, easing = Motion.Enter)) { it / 8 } + fadeIn(tween(Motion.Medium, easing = Motion.Enter))
}
// A product opens as the picture grows from its card, with the sheet easing up under it. Closing reverses that: the
// sheet slides down and fades quickly while the picture glides back to its card, so nothing just vanishes.
private val ProductEnter: Scope.() -> EnterTransition = {
    fadeIn(tween(Motion.Medium, easing = Motion.Enter)) + slideInVertically(tween(Motion.Medium, easing = Motion.Enter)) { it / 16 }
}
private val ProductExit: Scope.() -> ExitTransition = {
    slideOutVertically(tween(Motion.Fast, easing = Motion.Exit)) { it / 8 } + fadeOut(tween(Motion.Fast, easing = Motion.Exit))
}
private val SinkExit: Scope.() -> ExitTransition = {
    slideOutVertically(tween(Motion.Fast, easing = Motion.Exit)) { it / 10 } + fadeOut(tween(Motion.Fast, easing = Motion.Exit))
}

@OptIn(ExperimentalSharedTransitionApi::class)
@Composable
fun CrustAppUi(navController: NavHostController = rememberNavController()) {
    val container = LocalAppContainer.current
    val backStackEntry by navController.currentBackStackEntryAsState()
    val destination = backStackEntry?.destination
    val snackbarHost = remember { SnackbarHostState() }
    val cartCount = rememberCartCount()
    val selectedTab = TabRoutes.indexOfFirst { route -> destination?.hierarchy?.any { it.hasRoute(route::class) } == true }

    // Tabs always unwind to Home first, so switching tabs never piles up screens on the back stack.
    fun navigateToTab(route: Any) {
        navController.navigate(route) {
            popUpTo<HomeRoute> { saveState = true }
            launchSingleTop = true
            restoreState = true
        }
    }

    fun openProduct(id: String) = navController.navigate(ProductRoute(id))
    fun openAddresses() = navController.navigate(AddressesRoute) { launchSingleTop = true }
    fun openSignIn() = navController.navigate(SignInRoute) { launchSingleTop = true }

    /** Leaves the welcome flow for Home. Safe to call when Welcome is no longer on the stack. */
    fun enterApp() {
        container.welcomeSeen = true
        navController.navigate(HomeRoute) { popUpTo<WelcomeRoute> { inclusive = true } }
    }

    val bar = listOf(
        BarItem("Home", Ph.House),
        BarItem("Menu", Ph.Pizza),
        BarItem("Search", Ph.MagnifyingGlass),
        BarItem("Cart", Ph.ShoppingBag, badge = cartCount),
        BarItem("Profile", Ph.User),
    )

    CompositionLocalProvider(LocalSnackbarHostState provides snackbarHost) {
        Scaffold(
            containerColor = MaterialTheme.colorScheme.background,
            snackbarHost = { SnackbarHost(snackbarHost) },
            bottomBar = {
                // Slides away on detail screens and back on tabs, so the content above it glides instead of jumping.
                AnimatedVisibility(
                    visible = selectedTab >= 0,
                    enter = slideInVertically(tween(Motion.Medium, easing = Motion.Enter)) { it } + fadeIn(tween(Motion.Medium)),
                    exit = slideOutVertically(tween(Motion.Fast, easing = Motion.Exit)) { it } + fadeOut(tween(Motion.Fast)),
                ) {
                    // The last real tab is kept while the bar slides out, so its highlight doesn't flicker to "none".
                    CrustBottomBar(items = bar, selectedIndex = selectedTab.coerceAtLeast(0), onSelect = { navigateToTab(TabRoutes[it]) })
                }
            },
        ) { innerPadding ->
            SharedTransitionLayout {
                CompositionLocalProvider(LocalSharedTransitionScope provides this) {
                    NavHost(
                        navController = navController,
                        startDestination = if (container.welcomeSeen) HomeRoute else WelcomeRoute,
                        enterTransition = SoftEnter,
                        exitTransition = SoftExit,
                        popEnterTransition = SoftEnter,
                        popExitTransition = SoftExit,
                    ) {
                        composable<WelcomeRoute>(exitTransition = { fadeOut(tween(Motion.Medium)) }) {
                            WelcomeScreen(onGetStarted = ::enterApp, onSignIn = ::openSignIn)
                        }
                        composable<SignInRoute>(enterTransition = RiseEnter, popExitTransition = SinkExit, exitTransition = SoftExit) {
                            SignInScreen(
                                contentPadding = innerPadding,
                                onBack = { navController.popBackStack() },
                                onContinueAsGuest = { if (container.welcomeSeen) navController.popBackStack() else enterApp() },
                                onSignedIn = { if (container.welcomeSeen) navController.popBackStack() else enterApp() },
                            )
                        }
                        composable<HomeRoute> {
                            CompositionLocalProvider(LocalAnimatedScope provides this) {
                                HomeScreen(
                                    contentPadding = innerPadding,
                                    onOpenMenu = { categoryId -> navigateToTab(MenuRoute(categoryId)) },
                                    onOpenProduct = ::openProduct,
                                    onOpenAddresses = ::openAddresses,
                                    onOpenSearch = { navigateToTab(SearchRoute) },
                                )
                            }
                        }
                        composable<MenuRoute> { entry ->
                            CompositionLocalProvider(LocalAnimatedScope provides this) {
                                MenuScreen(
                                    contentPadding = innerPadding,
                                    initialCategoryId = entry.toRoute<MenuRoute>().categoryId,
                                    onBack = { navigateToTab(HomeRoute) },
                                    onOpenProduct = ::openProduct,
                                )
                            }
                        }
                        composable<SearchRoute> {
                            CompositionLocalProvider(LocalAnimatedScope provides this) {
                                SearchScreen(contentPadding = innerPadding, onOpenProduct = ::openProduct)
                            }
                        }
                        composable<CartRoute> {
                            CartScreen(
                                contentPadding = innerPadding,
                                onBack = { navigateToTab(HomeRoute) },
                                onBrowseMenu = { navigateToTab(MenuRoute()) },
                                onCheckout = { couponCode -> navController.navigate(CheckoutRoute(couponCode)) },
                            )
                        }
                        composable<ProfileRoute> {
                            ProfileScreen(
                                contentPadding = innerPadding,
                                onBack = { navigateToTab(HomeRoute) },
                                onOpenAddresses = ::openAddresses,
                                onOpenOrders = { navController.navigate(OrdersRoute) { launchSingleTop = true } },
                                onSignIn = ::openSignIn,
                            )
                        }
                        composable<ProductRoute>(enterTransition = ProductEnter, popExitTransition = ProductExit) { entry ->
                            CompositionLocalProvider(LocalAnimatedScope provides this) {
                                ProductDetailScreen(
                                    productId = entry.toRoute<ProductRoute>().productId,
                                    contentPadding = innerPadding,
                                    onBack = { navController.popBackStack() },
                                )
                            }
                        }
                        composable<CheckoutRoute>(enterTransition = RiseEnter, popExitTransition = SinkExit, exitTransition = SoftExit) { entry ->
                            CheckoutScreen(
                                contentPadding = innerPadding,
                                couponCode = entry.toRoute<CheckoutRoute>().couponCode,
                                onExit = { navController.popBackStack() },
                                // Replace checkout with the tracking page, so Back from tracking lands on Home, not on a spent checkout.
                                onTrackOrder = { orderId ->
                                    navController.navigate(TrackingRoute(orderId)) { popUpTo<HomeRoute> { inclusive = false } }
                                },
                                onGoHome = { navigateToTab(HomeRoute) },
                            )
                        }
                        composable<TrackingRoute> { entry ->
                            TrackingScreen(
                                orderId = entry.toRoute<TrackingRoute>().orderId,
                                contentPadding = innerPadding,
                                onBack = { navController.popBackStack() },
                            )
                        }
                        composable<OrdersRoute> {
                            OrdersScreen(
                                contentPadding = innerPadding,
                                onBack = { navController.popBackStack() },
                                onOpenOrder = { orderId -> navController.navigate(TrackingRoute(orderId)) },
                            )
                        }
                        composable<AddressesRoute> {
                            AddressesScreen(contentPadding = innerPadding, onBack = { navController.popBackStack() })
                        }
                    }
                }
            }
        }
    }
}
