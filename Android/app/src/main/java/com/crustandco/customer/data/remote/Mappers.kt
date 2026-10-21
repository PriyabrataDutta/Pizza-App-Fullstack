package com.crustandco.customer.data.remote

import com.crustandco.customer.core.Money
import com.crustandco.customer.domain.Address
import com.crustandco.customer.domain.CheckoutItem
import com.crustandco.customer.domain.NewAddress
import com.crustandco.customer.domain.OrderLine
import com.crustandco.customer.domain.PaymentMethod
import com.crustandco.customer.domain.Quote
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
    number = number,
    status = OrderStatus.fromWire(status),
    total = Money(totalMinor, currency),
    createdAt = createdAt,
    lines = lines.map { OrderLine(name = it.name, variantName = it.portion, optionNames = it.options, quantity = it.quantity, lineTotal = Money(it.lineTotalMinor, currency)) },
    subtotal = subtotalMinor?.let { Money(it, currency) },
    discount = discountMinor?.let { Money(it, currency) },
    tax = taxMinor?.let { Money(it, currency) },
    deliveryFee = deliveryFeeMinor?.let { Money(it, currency) },
    deliveryAddress = deliveryAddress,
    paymentMethod = PaymentMethod.entries.firstOrNull { it.wire == paymentMethod },
    estimatedMinutes = estimatedMinutes,
)

fun AddressDto.toDomain() = Address(id = id, label = label, line1 = line1, locality = locality, city = city, postalCode = postalCode)

fun NewAddress.toBody() = NewAddressBody(label = label.trim(), line1 = line1.trim(), locality = locality.trim(), city = city.trim(), postalCode = postalCode.trim())

fun QuoteDto.toDomain() = Quote(
    subtotal = Money(subtotalMinor, currency),
    discount = Money(discountMinor, currency),
    tax = Money(taxMinor, currency),
    deliveryFee = Money(deliveryFeeMinor, currency),
    total = Money(totalMinor, currency),
    couponCode = couponCode,
)

fun CheckoutItem.toBody() = CartLineBody(productId = productId, portionKey = variantId, optionIds = optionIds, quantity = quantity)
