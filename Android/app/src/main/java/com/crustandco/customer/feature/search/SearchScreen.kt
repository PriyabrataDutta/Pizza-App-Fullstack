package com.crustandco.customer.feature.search

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import com.crustandco.customer.LocalAppContainer
import com.crustandco.customer.core.UiState
import com.crustandco.customer.core.designsystem.Ph
import com.crustandco.customer.core.designsystem.PhIcon
import com.crustandco.customer.core.designsystem.components.EmptyState
import com.crustandco.customer.core.designsystem.components.ErrorState
import com.crustandco.customer.core.designsystem.components.FilterChip
import com.crustandco.customer.core.designsystem.components.ProductListSkeleton
import com.crustandco.customer.core.designsystem.components.ProductRow
import com.crustandco.customer.core.designsystem.components.artKindFor
import com.crustandco.customer.core.designsystem.staggeredEntrance
import com.crustandco.customer.core.rememberNotifier

/** Words that find something in the demo menu. Tapping one runs that search. */
private val Suggestions = listOf("Pizza", "Paneer", "Garlic", "Cheese", "Chocolate", "Pepperoni")

@Composable
fun SearchScreen(contentPadding: PaddingValues, onOpenProduct: (String) -> Unit) {
    val container = LocalAppContainer.current
    val viewModel: SearchViewModel = viewModel(
        factory = viewModelFactory { initializer { SearchViewModel(container.catalogRepository, container.cartStore) } },
    )
    val state by viewModel.state.collectAsStateWithLifecycle()
    val notify = rememberNotifier()
    val focus = remember { FocusRequester() }
    val focusManager = LocalFocusManager.current

    // Opening the tab is a request to search, so the keyboard comes up straight away.
    LaunchedEffect(Unit) { focus.requestFocus() }

    Column(Modifier.fillMaxSize().padding(top = contentPadding.calculateTopPadding())) {
        Text("Search", style = MaterialTheme.typography.headlineSmall, modifier = Modifier.padding(start = 20.dp, end = 20.dp, top = 16.dp, bottom = 12.dp))

        OutlinedTextField(
            value = state.query,
            onValueChange = viewModel::onQueryChange,
            modifier = Modifier.fillMaxWidth().padding(horizontal = 20.dp).focusRequester(focus),
            singleLine = true,
            shape = MaterialTheme.shapes.medium,
            placeholder = { Text("Search pizzas, sides, desserts…") },
            leadingIcon = { PhIcon(Ph.MagnifyingGlass, contentDescription = null, tint = MaterialTheme.colorScheme.onSurfaceVariant) },
            trailingIcon = {
                if (state.query.isNotEmpty()) {
                    IconButton(onClick = viewModel::clear) { PhIcon(Ph.X, contentDescription = "Clear search") }
                }
            },
            keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
            keyboardActions = KeyboardActions(onSearch = {
                viewModel.submit()
                focusManager.clearFocus()
            }),
        )

        val results = state.results
        if (results == null) {
            Text("Popular searches", style = MaterialTheme.typography.titleMedium, modifier = Modifier.padding(start = 20.dp, end = 20.dp, top = 20.dp, bottom = 10.dp))
            LazyRow(contentPadding = PaddingValues(horizontal = 20.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                items(Suggestions) { word ->
                    FilterChip(word, selected = false, onClick = {
                        viewModel.onQueryChange(word)
                        viewModel.submit()
                        focusManager.clearFocus()
                    })
                }
            }
            if (state.query.isNotEmpty()) {
                Text("Keep typing: search starts at 2 letters.", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(20.dp))
            }
        } else {
            if (results is UiState.Success) {
                Text(
                    if (results.data.size == 1) "1 result" else "${results.data.size} results",
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(start = 20.dp, top = 14.dp).semantics { liveRegion = LiveRegionMode.Polite },
                )
            }
            LazyColumn(
                contentPadding = PaddingValues(start = 20.dp, end = 20.dp, top = 12.dp, bottom = contentPadding.calculateBottomPadding() + 24.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                when (results) {
                    UiState.Loading -> item { ProductListSkeleton("Searching") }
                    is UiState.Error -> item { ErrorState(results.error, onRetry = viewModel::retry) }
                    is UiState.Success ->
                        if (results.data.isEmpty()) {
                            item { EmptyState("No matches", "Nothing matched “${state.query.trim()}”. Try another word, like pizza or garlic.") }
                        } else {
                            itemsIndexed(results.data, key = { _, product -> product.id }) { index, product ->
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
