package com.crustandco.customer.feature.product

import com.crustandco.customer.core.designsystem.components.rememberPhotoId
import com.crustandco.customer.core.designsystem.components.productPhotoName
import com.crustandco.customer.core.designsystem.components.AnimatedMoney
import com.crustandco.customer.core.designsystem.sharedProductArt
import coil3.compose.AsyncImage
import com.crustandco.customer.core.designsystem.PriceDetail
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.layout.ContentScale
import androidx.compose.foundation.Image
import com.crustandco.customer.core.designsystem.Ph
import com.crustandco.customer.core.designsystem.PhIcon
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.selection.toggleable
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Checkbox
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import com.crustandco.customer.LocalAppContainer
import com.crustandco.customer.core.Money
import com.crustandco.customer.core.UiState
import com.crustandco.customer.core.comingSoon
import com.crustandco.customer.core.designsystem.Palette
import com.crustandco.customer.core.designsystem.Tabular
import com.crustandco.customer.core.designsystem.components.ChoiceTile
import com.crustandco.customer.core.designsystem.components.DietaryMark
import com.crustandco.customer.core.designsystem.components.ErrorState
import com.crustandco.customer.core.designsystem.components.KindArt
import com.crustandco.customer.core.designsystem.components.LoadingState
import com.crustandco.customer.core.designsystem.components.PrimaryButton
import com.crustandco.customer.core.designsystem.components.QuantityStepper
import com.crustandco.customer.core.designsystem.components.artKindFor
import com.crustandco.customer.core.rememberNotifier
import com.crustandco.customer.domain.CustomizationGroup
import com.crustandco.customer.domain.CustomizationOption
import com.crustandco.customer.domain.MAX_LINE_QUANTITY
import com.crustandco.customer.domain.Product
import com.crustandco.customer.domain.effectiveMax
import com.crustandco.customer.domain.isSingleChoice

private val HeroHeight = 260.dp
private val SheetOverlap = 28.dp

@Composable
fun ProductDetailScreen(
    productId: String,
    contentPadding: PaddingValues,
    onBack: () -> Unit,
) {
    val container = LocalAppContainer.current
    val viewModel: ProductDetailViewModel = viewModel(
        key = "product-$productId",
        factory = viewModelFactory {
            initializer { ProductDetailViewModel(productId, container.catalogRepository, container.cartStore) }
        },
    )
    val state by viewModel.state.collectAsStateWithLifecycle()
    val notify = rememberNotifier()

    // Added to the cart: go back to where the customer came from. The cart tab's badge shows the new count.
    LaunchedEffect(state.added) {
        if (state.added) {
            notify("Added to your cart")
            viewModel.consumeAdded()
            onBack()
        }
    }

    Box(Modifier.fillMaxSize()) {
        // Hero. Real photography replaces the illustration once products have image URLs.
        Box(
            Modifier
                .fillMaxWidth()
                .height(HeroHeight)
                .background(Brush.verticalGradient(listOf(Palette.Brown800, Palette.Brown950))),
            contentAlignment = Alignment.Center,
        ) {
            val loaded = (state.product as? UiState.Success)?.data
            if (loaded != null) {
                val photoId = rememberPhotoId(productPhotoName(loaded))
                if (loaded.imageUrl != null) {
                    // The small copy is already in memory from the list, so it shows at once while the full picture loads over it.
                    Box(Modifier.fillMaxSize().sharedProductArt(loaded.id)) {
                        AsyncImage(model = loaded.thumbUrl, contentDescription = null, modifier = Modifier.fillMaxSize(), contentScale = ContentScale.Crop)
                        AsyncImage(model = loaded.imageUrl, contentDescription = loaded.name, modifier = Modifier.fillMaxSize(), contentScale = ContentScale.Crop)
                    }
                } else if (photoId != 0) {
                    Image(painterResource(photoId), contentDescription = null, modifier = Modifier.fillMaxSize().sharedProductArt(loaded.id), contentScale = ContentScale.Crop)
                } else {
                    KindArt(
                        state.categories.artKindFor(loaded),
                        Modifier.size(190.dp).padding(top = 24.dp).sharedProductArt(loaded.id),
                        fallbackLetter = loaded.name.take(1),
                    )
                }
            }
        }

        Row(
            Modifier.fillMaxWidth().padding(top = contentPadding.calculateTopPadding() + 8.dp, start = 16.dp, end = 16.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
        ) {
            RoundIconButton(onClick = onBack, description = "Back") { PhIcon(Ph.ArrowLeft, contentDescription = null) }
            RoundIconButton(onClick = { notify(comingSoon("Favourites")) }, description = "Add to favourites") {
                PhIcon(Ph.Heart, contentDescription = null, tint = MaterialTheme.colorScheme.primary)
            }
        }

        Column(Modifier.fillMaxSize().padding(top = HeroHeight - SheetOverlap)) {
            Surface(
                modifier = Modifier.weight(1f).fillMaxWidth(),
                shape = RoundedCornerShape(topStart = 28.dp, topEnd = 28.dp),
                color = MaterialTheme.colorScheme.background,
            ) {
                when (val loaded = state.product) {
                    UiState.Loading -> LoadingState(label = "Loading item")
                    is UiState.Error -> ErrorState(loaded.error, onRetry = viewModel::retry)
                    is UiState.Success -> SheetContent(loaded.data, state, viewModel, contentPadding.calculateBottomPadding())
                }
            }
        }
    }
}

@Composable
private fun RoundIconButton(onClick: () -> Unit, description: String, content: @Composable () -> Unit) {
    Surface(onClick = onClick, shape = CircleShape, color = MaterialTheme.colorScheme.surface, modifier = Modifier.size(44.dp)) {
        Box(Modifier.fillMaxSize().semantics { contentDescription = description }, contentAlignment = Alignment.Center) { content() }
    }
}

@Composable
private fun SheetContent(product: Product, state: ProductDetailState, viewModel: ProductDetailViewModel, bottomInset: Dp) {
    Column(Modifier.fillMaxSize()) {
        LazyColumn(
            modifier = Modifier.weight(1f),
            contentPadding = PaddingValues(start = 20.dp, end = 20.dp, top = 18.dp, bottom = 8.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            item {
                Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        DietaryMark(product.dietaryType)
                        Text(product.name, style = MaterialTheme.typography.headlineSmall)
                    }
                    if (product.description.isNotBlank()) {
                        Text(product.description, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                    if (!product.isAvailable) {
                        Text("Not available right now.", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.error)
                    }
                }
            }

            if (product.variants.isNotEmpty()) {
                item {
                    Section(title = "Size", note = "Required", error = state.issueFor(null)) {
                        ChoiceGrid(product.variants) { variant, modifier ->
                            ChoiceTile(
                                title = variant.name,
                                subtitle = if (variant.isAvailable) variant.price.format() else "Unavailable",
                                selected = variant.id == state.selection.variantId,
                                enabled = variant.isAvailable,
                                onClick = { viewModel.selectVariant(variant.id) },
                                modifier = modifier,
                            )
                        }
                    }
                }
            }

            items(product.customizationGroups, key = { it.id }) { group ->
                val selected = state.selection.options[group.id].orEmpty()
                Section(title = group.name, note = requirementNote(group), error = state.issueFor(group.id)) {
                    if (group.isSingleChoice) {
                        ChoiceGrid(group.options) { option, modifier ->
                            ChoiceTile(
                                title = option.name,
                                subtitle = option.priceFor(state.selection.variantId).let { price -> if (price.minor == 0L) null else "+${price.format()}" },
                                selected = option.id in selected,
                                onClick = { viewModel.toggleOption(group.id, option.id) },
                                modifier = modifier,
                            )
                        }
                    } else {
                        Column {
                            group.options.forEach { option ->
                                CheckRow(option, option.priceFor(state.selection.variantId), option.id in selected) { viewModel.toggleOption(group.id, option.id) }
                            }
                        }
                    }
                }
            }

        }

        // Always visible: the price and the red button, as in the reference.
        Column(
            Modifier.fillMaxWidth().padding(start = 20.dp, end = 20.dp, top = 8.dp, bottom = 16.dp + bottomInset),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween) {
                Text("Quantity", style = MaterialTheme.typography.titleMedium)
                QuantityStepper(
                    quantity = state.quantity,
                    itemName = product.name,
                    onDecrease = viewModel::decreaseQuantity,
                    onIncrease = viewModel::increaseQuantity,
                    maxQuantity = MAX_LINE_QUANTITY,
                )
            }
            Row(verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                state.total?.let { AnimatedMoney(it, PriceDetail) } ?: Text("Choose a size", style = PriceDetail)
                // Prices are always indicative until the server confirms them at checkout.
                Text("indicative", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(bottom = 6.dp))
            }
            PrimaryButton(text = "Add to Cart", onClick = viewModel::addToCart, enabled = product.isAvailable, modifier = Modifier.fillMaxWidth().heightIn(min = 56.dp))
        }
    }
}

private fun requirementNote(group: CustomizationGroup): String = when {
    group.isRequired && group.isSingleChoice -> "Required"
    group.isRequired -> "Required · up to ${group.effectiveMax}"
    group.isSingleChoice -> "Optional"
    else -> "Optional · up to ${group.effectiveMax}"
}

@Composable
private fun Section(title: String, note: String, error: String?, content: @Composable () -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.Bottom) {
                Text(title, style = MaterialTheme.typography.titleMedium)
                Text(note, style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(bottom = 2.dp))
            }
            // Errors say what to do, in text (not color alone).
            if (error != null) Text(error, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.error)
        }
        content()
    }
}

/** Up to three choices share the row equally, like the reference. More wrap onto further rows. */
@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun <T> ChoiceGrid(items: List<T>, tile: @Composable (T, Modifier) -> Unit) {
    if (items.size <= 3) {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            items.forEach { tile(it, Modifier.weight(1f)) }
        }
    } else {
        FlowRow(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            items.forEach { tile(it, Modifier) }
        }
    }
}

@Composable
private fun CheckRow(option: CustomizationOption, price: Money, selected: Boolean, onClick: () -> Unit) {
    Row(
        Modifier.fillMaxWidth().heightIn(min = 48.dp).toggleable(value = selected, role = Role.Checkbox, onValueChange = { onClick() }),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        // The whole row is the control; the visual is decorative so it isn't announced twice.
        Checkbox(checked = selected, onCheckedChange = null)
        Text(option.name, style = MaterialTheme.typography.bodyMedium, modifier = Modifier.weight(1f))
        Text(
            if (price.minor == 0L) "Included" else "+${price.format()}",
            style = MaterialTheme.typography.bodyMedium.merge(Tabular),
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
}
