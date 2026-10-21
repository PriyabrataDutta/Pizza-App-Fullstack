package com.crustandco.customer.data.mock

import com.crustandco.customer.core.AppError
import com.crustandco.customer.core.AppResult
import com.crustandco.customer.core.Money
import com.crustandco.customer.domain.CheckoutItem
import com.crustandco.customer.domain.Product
import com.crustandco.customer.domain.Quote

// The mock "server" pricing rules. They stand in for the Next.js backend: prices come only from the catalog
// (looked up by ID), never from what the app sends. Rules mirror the dashboard's demo data (docs/database-schema.md).

internal data class DemoCoupon(
    val code: String,
    val percent: Int? = null,
    val fixed: Money? = null,
    val minimumOrder: Money,
    val maximumDiscount: Money? = null,
    val active: Boolean = true,
)

// Demo coupons (the printed menu has none): amounts in euros.
internal val demoCoupons = listOf(
    DemoCoupon("WELCOME5", fixed = euros(500), minimumOrder = euros(2000)),
    DemoCoupon("PIZZA2", fixed = euros(200), minimumOrder = euros(1200)),
    DemoCoupon("FEAST10", percent = 10, minimumOrder = euros(3000), maximumDiscount = euros(1000)),
    DemoCoupon("WINTER15", percent = 15, minimumOrder = euros(2500), maximumDiscount = euros(1000), active = false),
)

internal object MockPricing {
    // Menu prices already include VAT, and the printed menu names no delivery fee, so none is added on top.
    const val TAX_PERCENT = 0
    val DELIVERY_FEE = Money.ZERO
    val FREE_DELIVERY_FROM = Money.ZERO
    const val ESTIMATED_MINUTES = 35

    fun quote(products: List<Product>, items: List<CheckoutItem>, couponCode: String?): AppResult<Quote> {
        if (items.isEmpty()) return AppResult.Failure(AppError.Validation("EMPTY_CART", "Your cart is empty."))

        var subtotal = Money.ZERO
        for (item in items) {
            val line = lineTotal(products, item)
                ?: return AppResult.Failure(AppError.Validation("ITEM_UNAVAILABLE", "An item in your cart isn’t available anymore. Remove it and try again."))
            subtotal += line
        }

        val coupon = couponCode?.trim()?.takeIf { it.isNotEmpty() }?.let { code ->
            when (val result = discountFor(code, subtotal)) {
                is AppResult.Failure -> return result
                is AppResult.Success -> code.uppercase() to result.data
            }
        }
        val discount = coupon?.second ?: Money.ZERO
        val afterDiscount = Money(subtotal.minor - discount.minor)
        val tax = Money((afterDiscount.minor * TAX_PERCENT + 50) / 100)
        val delivery = if (subtotal.minor >= FREE_DELIVERY_FROM.minor) Money.ZERO else DELIVERY_FEE
        return AppResult.Success(
            Quote(
                subtotal = subtotal,
                discount = discount,
                tax = tax,
                deliveryFee = delivery,
                total = Money(afterDiscount.minor + tax.minor + delivery.minor),
                couponCode = coupon?.first,
            ),
        )
    }

    fun lineTotal(products: List<Product>, item: CheckoutItem): Money? {
        val product = products.firstOrNull { it.id == item.productId } ?: return null
        val variant = product.variants.firstOrNull { it.id == item.variantId && it.isAvailable } ?: return null
        if (item.quantity !in 1..99) return null
        var unit = variant.price
        for (optionId in item.optionIds) {
            val option = product.customizationGroups.flatMap { it.options }.firstOrNull { it.id == optionId } ?: return null
            unit += option.priceFor(variant.id)
        }
        return unit * item.quantity
    }

    private fun discountFor(code: String, subtotal: Money): AppResult<Money> {
        val coupon = demoCoupons.firstOrNull { it.code.equals(code, ignoreCase = true) }
            ?: return AppResult.Failure(AppError.Validation("COUPON_INVALID", "That code isn’t valid. Check it and try again."))
        if (!coupon.active) return AppResult.Failure(AppError.Validation("COUPON_EXPIRED", "That offer has ended."))
        if (subtotal.minor < coupon.minimumOrder.minor) {
            val short = Money(coupon.minimumOrder.minor - subtotal.minor)
            return AppResult.Failure(AppError.Validation("COUPON_MINIMUM", "Add ${short.format()} more to use ${coupon.code}."))
        }
        val raw = coupon.fixed ?: Money(subtotal.minor * (coupon.percent ?: 0) / 100)
        val capped = coupon.maximumDiscount?.let { Money(minOf(raw.minor, it.minor)) } ?: raw
        return AppResult.Success(Money(minOf(capped.minor, subtotal.minor)))
    }
}
