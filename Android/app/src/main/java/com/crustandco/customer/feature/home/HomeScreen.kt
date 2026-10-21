package com.crustandco.customer.feature.home

import com.crustandco.customer.domain.AuthState
import com.crustandco.customer.core.designsystem.staggeredEntrance
import com.crustandco.customer.core.designsystem.components.ProductTileSkeleton
import androidx.compose.runtime.remember
import androidx.compose.foundation.lazy.grid.itemsIndexed
import com.crustandco.customer.core.designsystem.Ph
import com.crustandco.customer.core.designsystem.PhIcon
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.wrapContentHeight
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.GridItemSpan
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import com.crustandco.customer.LocalAppContainer
import com.crustandco.customer.core.UiState
import com.crustandco.customer.core.comingSoon
import com.crustandco.customer.core.designsystem.components.ArtKind
import com.crustandco.customer.core.designsystem.components.CategoryCircle
import com.crustandco.customer.core.designsystem.components.EmptyState
import com.crustandco.customer.core.designsystem.components.ErrorState
import com.crustandco.customer.core.designsystem.components.LoadingState
import com.crustandco.customer.core.designsystem.components.ProductTile
import com.crustandco.customer.core.designsystem.components.PromoCarousel
import com.crustandco.customer.core.designsystem.components.SearchEntry
import com.crustandco.customer.core.designsystem.components.artKind
import com.crustandco.customer.core.designsystem.components.artKindFor
import com.crustandco.customer.core.rememberNotifier

@Composable
fun HomeScreen(
    contentPadding: PaddingValues,
    onOpenMenu: (categoryId: String?) -> Unit,
    onOpenSearch: () -> Unit,
    onOpenProduct: (String) -> Unit,
    onOpenAddresses: () -> Unit,
) {
    val container = LocalAppContainer.current
    val viewModel: HomeViewModel = viewModel(
        factory = viewModelFactory {
            initializer {
                HomeViewModel(container.catalogRepository, container.promotionRepository, container.addressRepository, container.cartStore)
            }
        },
    )
    val state by viewModel.state.collectAsStateWithLifecycle()
    val notify = rememberNotifier()
    val auth by container.authRepository.state.collectAsStateWithLifecycle()

    LazyVerticalGrid(
        columns = GridCells.Fixed(2),
        contentPadding = PaddingValues(
            start = 20.dp,
            end = 20.dp,
            top = contentPadding.calculateTopPadding() + 8.dp,
            bottom = contentPadding.calculateBottomPadding() + 24.dp,
        ),
        horizontalArrangement = Arrangement.spacedBy(12.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        item(span = { GridItemSpan(maxLineSpan) }) {
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                Row(
                    Modifier.weight(1f).heightIn(min = 48.dp).clickable(onClick = onOpenAddresses),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    PhIcon(Ph.MapPin, contentDescription = null, tint = MaterialTheme.colorScheme.primary, filled = true, size = 26.dp)
                    Column {
                        Text("Deliver to", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text(
                                state.deliverTo ?: "Add your address",
                                style = MaterialTheme.typography.titleMedium,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis,
                                modifier = Modifier.weight(1f, fill = false),
                            )
                            PhIcon(Ph.CaretDown, contentDescription = null, size = 18.dp)
                        }
                    }
                }
                IconButton(onClick = { notify(comingSoon("Notifications")) }) {
                    PhIcon(Ph.Bell, contentDescription = "Notifications")
                }
            }
        }

        item(span = { GridItemSpan(maxLineSpan) }) {
            val hour = remember { java.time.LocalTime.now().hour }
            val partOfDay = when {
                hour < 12 -> "Good morning"
                hour < 17 -> "Good afternoon"
                else -> "Good evening"
            }
            val firstName = (auth as? AuthState.SignedIn)?.user?.firstName
            Column(Modifier.staggeredEntrance(0), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Text(
                    if (firstName != null) "$partOfDay, $firstName" else partOfDay,
                    style = MaterialTheme.typography.bodyLarge,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Text("What are you craving?", style = MaterialTheme.typography.headlineLarge)
            }
        }

        item(span = { GridItemSpan(maxLineSpan) }) {
            SearchEntry(placeholder = "Search for pizzas, sides, drinks…", onClick = onOpenSearch)
        }

        if (state.promotions.isNotEmpty()) {
            item(span = { GridItemSpan(maxLineSpan) }) { PromoCarousel(state.promotions, onOrderNow = { onOpenMenu(null) }) }
        }

        if (state.categories.isNotEmpty()) {
            item(span = { GridItemSpan(maxLineSpan) }) {
                LazyRow(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                    item { CategoryCircle("All", ArtKind.Pizza, selected = true, onClick = { onOpenMenu(null) }) }
                    items(state.categories, key = { it.id }) { category ->
                        CategoryCircle(category.name, category.artKind(), selected = false, onClick = { onOpenMenu(category.id) })
                    }
                }
            }
        }

        item(span = { GridItemSpan(maxLineSpan) }) {
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween) {
                Text("Popular Pizzas", style = MaterialTheme.typography.headlineMedium)
                Text(
                    "See All ›",
                    style = MaterialTheme.typography.labelLarge,
                    color = MaterialTheme.colorScheme.primary,
                    modifier = Modifier.heightIn(min = 48.dp).clickable { onOpenMenu(null) }.padding(horizontal = 4.dp).wrapContentHeight(Alignment.CenterVertically),
                )
            }
        }

        when (val popular = state.popular) {
            UiState.Loading -> items(4) { ProductTileSkeleton() }
            is UiState.Error -> item(span = { GridItemSpan(maxLineSpan) }) { ErrorState(popular.error, onRetry = viewModel::retry) }
            is UiState.Success -> {
                val shown = state.popularPizzas(popular.data)
                if (shown.isEmpty()) {
                    item(span = { GridItemSpan(maxLineSpan) }) { EmptyState("No popular pizzas yet", "Browse the full menu to see everything we make.") }
                } else {
                    itemsIndexed(shown, key = { _, product -> product.id }) { index, product ->
                        ProductTile(
                            modifier = Modifier.staggeredEntrance(index),
                            product = product,
                            kind = state.categories.artKindFor(product),
                            onClick = { onOpenProduct(product.id) },
                            onAdd = {
                                if (viewModel.quickAdd(product)) notify("Added ${product.name} to your cart") else onOpenProduct(product.id)
                            },
                        )
                    }
                }
            }
        }
    }
}
