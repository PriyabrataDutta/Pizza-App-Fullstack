package com.crustandco.customer.feature.menu

import com.crustandco.customer.core.designsystem.staggeredEntrance
import com.crustandco.customer.core.designsystem.components.ProductListSkeleton
import androidx.compose.foundation.lazy.itemsIndexed
import com.crustandco.customer.core.designsystem.Ph
import com.crustandco.customer.core.designsystem.PhIcon
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.foundation.layout.Row
import androidx.compose.ui.Alignment
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import com.crustandco.customer.core.designsystem.CrustTheme
import com.crustandco.customer.core.designsystem.components.FilterChip
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import com.crustandco.customer.LocalAppContainer
import com.crustandco.customer.core.UiState
import com.crustandco.customer.core.designsystem.components.CrustTopBar
import com.crustandco.customer.core.designsystem.components.EmptyState
import com.crustandco.customer.core.designsystem.components.ErrorState
import com.crustandco.customer.core.designsystem.components.LoadingState
import com.crustandco.customer.core.designsystem.components.PillTab
import com.crustandco.customer.core.designsystem.components.ProductRow
import com.crustandco.customer.core.designsystem.components.PromoBanner
import com.crustandco.customer.core.designsystem.components.artKindFor
import com.crustandco.customer.core.rememberNotifier

@Composable
fun MenuScreen(
    contentPadding: PaddingValues,
    initialCategoryId: String?,
    onBack: () -> Unit,
    onOpenProduct: (String) -> Unit,
) {
    val container = LocalAppContainer.current
    val viewModel: MenuViewModel = viewModel(
        factory = viewModelFactory {
            initializer { MenuViewModel(container.catalogRepository, container.promotionRepository, container.cartStore) }
        },
    )
    val state by viewModel.state.collectAsStateWithLifecycle()
    val notify = rememberNotifier()
    var searchOpen by rememberSaveable { mutableStateOf(false) }

    // Coming from a Home category shortcut: pick that category. Plain tab visits (null) leave the current choice alone.
    LaunchedEffect(initialCategoryId) {
        if (initialCategoryId != null) viewModel.selectCategory(initialCategoryId)
    }

    Column(Modifier.fillMaxSize().padding(top = contentPadding.calculateTopPadding())) {
        CrustTopBar(
            title = "Menu",
            onBack = onBack,
            trailing = {
                IconButton(onClick = {
                    if (searchOpen) viewModel.clearSearch()
                    searchOpen = !searchOpen
                }) {
                    PhIcon(if (searchOpen) Ph.X else Ph.MagnifyingGlass, contentDescription = if (searchOpen) "Close search" else "Search the menu")
                }
            },
        )

        // Filters stay pinned above the list so they are reachable at any scroll position.
        if (searchOpen) {
            OutlinedTextField(
                value = state.query,
                onValueChange = viewModel::onQueryChange,
                modifier = Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 4.dp),
                singleLine = true,
                shape = MaterialTheme.shapes.medium,
                label = { Text("Search the menu") },
                keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
                keyboardActions = KeyboardActions(onSearch = { viewModel.submitSearch() }),
            )
        }

        LazyRow(
            contentPadding = PaddingValues(horizontal = 20.dp, vertical = 8.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            item { PillTab("All", selected = !state.dealsSelected && state.selectedCategoryId == null, onClick = { viewModel.selectCategory(null) }) }
            items(state.categories, key = { it.id }) { category ->
                PillTab(category.name, selected = !state.dealsSelected && state.selectedCategoryId == category.id, onClick = { viewModel.selectCategory(category.id) }, imageUrl = category.thumbUrl ?: category.imageUrl)
            }
            if (state.promotions.isNotEmpty()) {
                item { PillTab("Deals", selected = state.dealsSelected, onClick = viewModel::selectDeals) }
            }
        }

        if (!state.dealsSelected) {
            val status = CrustTheme.status
            val filtered = state.diet != DietFilter.All || state.selectedCategoryId != null
            Row(Modifier.fillMaxWidth().padding(start = 20.dp, end = 12.dp), verticalAlignment = Alignment.CenterVertically) {
                LazyRow(Modifier.weight(1f), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    items(DietFilter.entries, key = { it.name }) { diet ->
                        val marker = when (diet) {
                            DietFilter.Veg -> status.success.foreground
                            DietFilter.NonVeg -> status.error.foreground
                            else -> null
                        }
                        FilterChip(diet.label, selected = state.diet == diet, onClick = { viewModel.selectDiet(diet) }, marker = marker)
                    }
                }
                if (filtered) {
                    TextButton(onClick = {
                        viewModel.selectDiet(DietFilter.All)
                        viewModel.selectCategory(null)
                    }) { Text("Clear", style = MaterialTheme.typography.labelLarge) }
                }
            }
            (state.visibleProducts as? UiState.Success)?.let { shown ->
                Text(
                    if (shown.data.size == 1) "1 item" else "${shown.data.size} items",
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(start = 20.dp, top = 6.dp).semantics { liveRegion = LiveRegionMode.Polite },
                )
            }
        }

        LazyColumn(
            contentPadding = PaddingValues(start = 20.dp, end = 20.dp, top = 8.dp, bottom = contentPadding.calculateBottomPadding() + 24.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            if (state.dealsSelected) {
                itemsIndexed(state.promotions, key = { _, promo -> promo.id }) { index, promo ->
                    PromoBanner(promo, onOrderNow = { viewModel.selectCategory(null) }, index = index)
                }
            } else {
                when (val products = state.visibleProducts) {
                    UiState.Loading -> item { ProductListSkeleton("Loading menu") }
                    is UiState.Error -> item { ErrorState(products.error, onRetry = viewModel::retry) }
                    is UiState.Success ->
                        if (products.data.isEmpty()) {
                            item { EmptyState("Nothing here yet", "No items match. Try a different category, filter or search.") }
                        } else {
                            itemsIndexed(products.data, key = { _, product -> product.id }) { index, product ->
                                ProductRow(
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
}
