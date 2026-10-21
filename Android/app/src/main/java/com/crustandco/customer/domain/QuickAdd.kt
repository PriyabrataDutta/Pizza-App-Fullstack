package com.crustandco.customer.domain

/**
 * The "+" on a list card adds straight to the cart only when there is nothing to choose:
 * exactly one available size and no required customization. Otherwise the customer is taken to the product screen.
 */
val Product.canQuickAdd: Boolean
    get() = !needsChoices && variants.count { it.isAvailable } == 1 && customizationGroups.none { it.effectiveMin > 0 }

/** The cart line for a quick add, or null when the customer has choices to make first. */
fun Product.quickAddItem(): CartItem? {
    if (!canQuickAdd) return null
    val variant = variants.first { it.isAvailable }
    return CartItem(productId = id, categoryId = categoryId, productName = name, variant = variant, options = emptyList(), quantity = 1)
}
