package com.crustandco.customer.data.remote

import com.crustandco.customer.core.Money
import com.crustandco.customer.domain.Category
import com.crustandco.customer.domain.CustomizationGroup
import com.crustandco.customer.domain.CustomizationOption
import com.crustandco.customer.domain.DietaryType
import com.crustandco.customer.domain.Order
import com.crustandco.customer.domain.OrderStatus
import com.crustandco.customer.domain.Product
import com.crustandco.customer.domain.Variant

// DTO -> domain mappers. Pure functions, easy to test. Anything the server omits gets a safe default.

fun CategoryDto.toDomain() = Category(id = id, name = name, imageUrl = imageUrl, thumbUrl = thumbUrl)

fun OptionDto.toDomain(currency: String) = CustomizationOption(
    id = id,
    name = name,
    // Prices come per size; the flat fallback stays zero because the server resolves every size.
    priceDelta = Money(0, currency),
    prices = prices.mapValues { (_, cents) -> Money(cents, currency) },
    isDefault = isDefault,
)

fun GroupDto.toDomain(currency: String) = CustomizationGroup(
    id = id,
    name = name,
    isRequired = required,
    minSelections = min,
    maxSelections = max,
    options = options.map { it.toDomain(currency) },
)

fun ProductDto.toDomain(): Product {
    // The app delivers only, so a pickup-only item (alcohol) is shown as unavailable instead of being hidden.
    val deliverable = !fulfillment.equals("pickup_only", ignoreCase = true)
    return Product(
        id = id,
        categoryId = categoryId,
        name = name,
        description = description.orEmpty(),
        imageUrl = imageUrl,
        thumbUrl = thumbUrl,
        dietaryType = if (diet.equals("non_veg", ignoreCase = true)) DietaryType.NonVeg else DietaryType.Veg,
        isSpicy = isSpicy,
        isBestseller = isBestseller,
        variants = portions.map { Variant(id = it.key, name = it.label, price = Money(it.priceMinor, currency), isAvailable = it.available && deliverable) },
        customizationGroups = groups.map { it.toDomain(currency) },
        needsChoices = needsChoices,
    )
}

fun OrderDto.toDomain() = Order(
    id = id,
    number = orderNumber,
    status = OrderStatus.fromWire(status),
    total = Money(totalMinor, currency),
    createdAt = createdAt,
)
