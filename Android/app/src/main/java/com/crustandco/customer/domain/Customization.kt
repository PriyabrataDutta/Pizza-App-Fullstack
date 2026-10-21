package com.crustandco.customer.domain

import com.crustandco.customer.core.Money

// Rules for choosing a size and customizations. Pure functions, no Android, easy to test.
// The server re-validates everything at checkout; this exists so the UI can guide the customer and show an indicative price.

/** What the customer has picked so far on the product screen. */
data class Selection(
    val variantId: String?,
    /** Selected option IDs per customization group ID. */
    val options: Map<String, Set<String>> = emptyMap(),
)

data class SelectionIssue(val groupId: String?, val message: String)

// docs/database-schema.md: selection_required, min_selections, max_selections. Interpretation (documented assumption):
//  - a required group needs at least 1 choice even if min_selections is 0
//  - max_selections <= 0 means "no limit" (all options)
val CustomizationGroup.effectiveMin: Int get() = if (isRequired) maxOf(minSelections, 1) else minSelections
val CustomizationGroup.effectiveMax: Int get() = if (maxSelections <= 0) options.size else maxSelections
val CustomizationGroup.isSingleChoice: Boolean get() = effectiveMax == 1

object SelectionRules {

    /** First available size, and for each required single-choice group (e.g. crust) its default option, else its first, so nothing starts invalid. */
    fun defaultSelection(product: Product): Selection {
        val variant = product.variants.firstOrNull { it.isAvailable }
        val options = product.customizationGroups
            .filter { it.isRequired && it.isSingleChoice && it.options.isNotEmpty() }
            .associate { group -> group.id to setOf((group.options.firstOrNull { it.isDefault } ?: group.options.first()).id) }
        return Selection(variant?.id, options)
    }

    fun selectVariant(product: Product, selection: Selection, variantId: String): Selection {
        val variant = product.variants.firstOrNull { it.id == variantId }
        return if (variant != null && variant.isAvailable) selection.copy(variantId = variantId) else selection
    }

    /**
     * Tap on an option. Single-choice groups swap the choice (and optional ones can be switched off again).
     * Multi-choice groups toggle, and ignore a tap that would exceed the maximum.
     */
    fun toggleOption(product: Product, selection: Selection, groupId: String, optionId: String): Selection {
        val group = product.customizationGroups.firstOrNull { it.id == groupId } ?: return selection
        if (group.options.none { it.id == optionId }) return selection
        val current = selection.options[groupId].orEmpty()
        val next = when {
            group.isSingleChoice -> if (optionId in current && !group.isRequired) emptySet() else setOf(optionId)
            optionId in current -> current - optionId
            current.size >= group.effectiveMax -> current
            else -> current + optionId
        }
        return selection.copy(options = selection.options + (groupId to next))
    }

    fun validate(product: Product, selection: Selection): List<SelectionIssue> {
        val issues = mutableListOf<SelectionIssue>()
        val variant = product.variants.firstOrNull { it.id == selection.variantId }
        if (variant == null || !variant.isAvailable) issues += SelectionIssue(null, "Choose a size.")
        for (group in product.customizationGroups) {
            val count = selection.options[group.id].orEmpty().count { id -> group.options.any { it.id == id } }
            when {
                count < group.effectiveMin -> issues += SelectionIssue(
                    group.id,
                    if (group.effectiveMin == 1) "Choose a ${group.name.lowercase()}." else "Choose at least ${group.effectiveMin} for ${group.name.lowercase()}.",
                )
                count > group.effectiveMax -> issues += SelectionIssue(group.id, "Choose up to ${group.effectiveMax} for ${group.name.lowercase()}.")
            }
        }
        return issues
    }

    fun selectedVariant(product: Product, selection: Selection): Variant? =
        product.variants.firstOrNull { it.id == selection.variantId && it.isAvailable }

    /** Selected options in menu order. IDs that don't belong to this product are ignored, never trusted. */
    fun selectedOptions(product: Product, selection: Selection): List<CustomizationOption> =
        product.customizationGroups.flatMap { group ->
            val chosen = selection.options[group.id].orEmpty()
            group.options.filter { it.id in chosen }
        }

    /** Indicative price of one item: size price plus option charges. Null until a size is chosen. */
    fun unitPrice(product: Product, selection: Selection): Money? {
        val variant = selectedVariant(product, selection) ?: return null
        return selectedOptions(product, selection).fold(variant.price) { total, option -> total + option.priceFor(variant.id) }
    }
}
