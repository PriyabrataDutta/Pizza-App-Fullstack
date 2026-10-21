package com.crustandco.customer.domain

import com.crustandco.customer.core.Money
import com.crustandco.customer.product
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class SelectionRulesTest {
    private val crust = CustomizationGroup(
        "g-crust", "Crust", isRequired = true, minSelections = 1, maxSelections = 1,
        options = listOf(
            CustomizationOption("hand", "Hand-tossed", Money.ZERO),
            CustomizationOption("thin", "Thin crust", Money.ZERO),
            CustomizationOption("burst", "Cheese burst", Money(6000)),
        ),
    )
    private val toppings = CustomizationGroup(
        "g-top", "Extra toppings", isRequired = false, minSelections = 0, maxSelections = 2,
        options = listOf(
            CustomizationOption("cheese", "Extra cheese", Money(4000)),
            CustomizationOption("olive", "Olives", Money(3000)),
            CustomizationOption("jala", "Jalapeño", Money(2500)),
        ),
    )
    private val pizza = product(
        variants = listOf(Variant("s", "Small", Money(19900), true), Variant("l", "Large", Money(39900), true), Variant("x", "Family", Money(59900), false)),
    ).copy(customizationGroups = listOf(crust, toppings))

    @Test
    fun `starts with the first size and the first crust so nothing begins invalid`() {
        val s = SelectionRules.defaultSelection(pizza)
        assertEquals("s", s.variantId)
        assertEquals(setOf("hand"), s.options["g-crust"])
        assertTrue(SelectionRules.validate(pizza, s).isEmpty())
    }

    @Test
    fun `price is size plus option charges`() {
        var s = SelectionRules.defaultSelection(pizza)
        s = SelectionRules.selectVariant(pizza, s, "l")
        s = SelectionRules.toggleOption(pizza, s, "g-crust", "burst")
        s = SelectionRules.toggleOption(pizza, s, "g-top", "cheese")
        assertEquals(Money(39900 + 6000 + 4000), SelectionRules.unitPrice(pizza, s))
    }

    @Test
    fun `an unavailable size cannot be selected`() {
        val s = SelectionRules.selectVariant(pizza, SelectionRules.defaultSelection(pizza), "x")
        assertEquals("s", s.variantId)
    }

    @Test
    fun `a single-choice required group swaps the choice and cannot be cleared`() {
        var s = SelectionRules.defaultSelection(pizza)
        s = SelectionRules.toggleOption(pizza, s, "g-crust", "thin")
        assertEquals(setOf("thin"), s.options["g-crust"])
        s = SelectionRules.toggleOption(pizza, s, "g-crust", "thin") // tapping it again must not leave the group empty
        assertEquals(setOf("thin"), s.options["g-crust"])
    }

    @Test
    fun `multi-choice groups toggle and stop at the maximum`() {
        var s = SelectionRules.defaultSelection(pizza)
        s = SelectionRules.toggleOption(pizza, s, "g-top", "cheese")
        s = SelectionRules.toggleOption(pizza, s, "g-top", "olive")
        s = SelectionRules.toggleOption(pizza, s, "g-top", "jala") // a third is ignored, the limit is 2
        assertEquals(setOf("cheese", "olive"), s.options["g-top"])
        s = SelectionRules.toggleOption(pizza, s, "g-top", "cheese")
        assertEquals(setOf("olive"), s.options["g-top"])
    }

    @Test
    fun `validation asks for a missing required choice in words`() {
        val s = SelectionRules.defaultSelection(pizza).copy(options = emptyMap())
        val issues = SelectionRules.validate(pizza, s)
        assertEquals("g-crust", issues.single().groupId)
        assertEquals("Choose a crust.", issues.single().message)
    }

    @Test
    fun `validation asks for a size when none is chosen`() {
        val issues = SelectionRules.validate(pizza, SelectionRules.defaultSelection(pizza).copy(variantId = null))
        assertEquals("Choose a size.", issues.first { it.groupId == null }.message)
    }

    @Test
    fun `option ids that do not belong to the product are ignored, never trusted`() {
        val forged = SelectionRules.defaultSelection(pizza).copy(options = mapOf("g-crust" to setOf("hand"), "g-top" to setOf("free-pizza")))
        assertEquals(Money(19900), SelectionRules.unitPrice(pizza, forged))
        assertEquals(listOf("hand"), SelectionRules.selectedOptions(pizza, forged).map { it.id })
    }

    @Test
    fun `quick add only when there is nothing to choose`() {
        assertFalse(pizza.canQuickAdd)
        assertNull(pizza.quickAddItem())
        val side = product(id = "garlic", variants = listOf(Variant("r", "Regular", Money(11900), true)))
        assertTrue(side.canQuickAdd)
        assertEquals(1, side.quickAddItem()?.quantity)
    }

    @Test
    fun `quick add is refused when a size must be chosen`() {
        assertFalse(product().canQuickAdd) // the default test product has two sizes
        assertNotNull(product(variants = listOf(Variant("r", "Regular", Money(100), true))).quickAddItem())
    }

    @Test
    fun `an order status maps to the right tracker step`() {
        assertEquals(0, OrderStatus.Placed.trackerStep)
        assertEquals(1, OrderStatus.ReadyForDispatch.trackerStep)
        assertEquals(2, OrderStatus.OutForDelivery.trackerStep)
        assertEquals(3, OrderStatus.Delivered.trackerStep)
        assertNull(OrderStatus.Cancelled.trackerStep)
    }
}
