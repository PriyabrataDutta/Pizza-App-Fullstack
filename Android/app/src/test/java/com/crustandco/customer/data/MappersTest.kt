package com.crustandco.customer.data

import com.crustandco.customer.core.Money
import com.crustandco.customer.data.remote.ApiJson
import com.crustandco.customer.data.remote.CategoryDto
import com.crustandco.customer.data.remote.ListResponseDto
import com.crustandco.customer.data.remote.OrderDto
import com.crustandco.customer.data.remote.ProductDto
import com.crustandco.customer.data.remote.toBody
import com.crustandco.customer.data.remote.toDomain
import com.crustandco.customer.domain.DietaryType
import com.crustandco.customer.domain.SelectionRules
import com.crustandco.customer.domain.canQuickAdd
import com.crustandco.customer.domain.OrderStatus
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class MappersTest {
    // A product as GET /api/products/{id} returns it: portions (sizes) and groups, with extra prices per portion key.
    private val productJson = """
        {
          "id": "p1", "category_id": "c1", "name": "Salami", "description": "mit Salami",
          "diet": "non_veg", "is_spicy": true, "is_bestseller": true, "currency": "EUR",
          "some_future_field": 42,
          "portions": [
            {"key": "klein", "label": "Klein 28 cm", "price_minor": 700, "available": true},
            {"key": "gross", "label": "Groß 32 cm", "price_minor": 900, "available": true},
            {"key": "maxi", "label": "Maxi 45 cm", "price_minor": 1900, "available": false}
          ],
          "groups": [
            {"id": "g1", "name": "Extra Zutaten", "kind": "extra", "min": 0, "max": 10, "required": false,
             "options": [{"id": "o1", "name": "Champignons", "is_default": false, "prices": {"klein": 50, "gross": 100, "maxi": 250}}]},
            {"id": "g2", "name": "Beilage", "kind": "choice", "min": 1, "max": 1, "required": true,
             "options": [{"id": "o2", "name": "Basmati-Reis", "is_default": false}, {"id": "o3", "name": "Pommes", "is_default": true}]}
          ]
        }
    """.trimIndent()

    @Test
    fun `maps a product and ignores unknown fields`() {
        val product = ApiJson.decodeFromString<ProductDto>(productJson).toDomain()

        assertEquals("Salami", product.name)
        assertEquals(DietaryType.NonVeg, product.dietaryType)
        assertTrue(product.isSpicy && product.isBestseller)
        assertEquals(3, product.variants.size)
        assertEquals(listOf("Extra Zutaten", "Beilage"), product.customizationGroups.map { it.name })
        assertTrue(product.customizationGroups[1].isRequired)
    }

    @Test
    fun `a portion's key becomes the variant id the app sends back`() {
        val product = ApiJson.decodeFromString<ProductDto>(productJson).toDomain()
        assertEquals(listOf("klein", "gross", "maxi"), product.variants.map { it.id })
        assertEquals(Money(900), product.variants[1].price)
    }

    @Test
    fun `an extra costs what the server says for the chosen size`() {
        val champignons = ApiJson.decodeFromString<ProductDto>(productJson).toDomain().customizationGroups[0].options.single()
        assertEquals(Money(50), champignons.priceFor("klein"))
        assertEquals(Money(100), champignons.priceFor("gross"))
        assertEquals(Money(250), champignons.priceFor("maxi"))
        assertEquals(Money.ZERO, champignons.priceFor("unknown-size"))
        assertEquals(Money.ZERO, champignons.priceFor(null))
    }

    @Test
    fun `the server's default option is preselected, not just the first`() {
        val product = ApiJson.decodeFromString<ProductDto>(productJson).toDomain()
        val selection = SelectionRules.defaultSelection(product)
        assertEquals(setOf("o3"), selection.options["g2"]) // Pommes is the default, Basmati-Reis is listed first
        assertEquals("klein", selection.variantId)
    }

    @Test
    fun `the price follows the size and the extras for that size`() {
        val product = ApiJson.decodeFromString<ProductDto>(productJson).toDomain()
        var selection = SelectionRules.defaultSelection(product)
        selection = SelectionRules.toggleOption(product, selection, "g1", "o1")
        assertEquals(Money(700 + 50), SelectionRules.unitPrice(product, selection))
        selection = SelectionRules.selectVariant(product, selection, "gross")
        assertEquals(Money(900 + 100), SelectionRules.unitPrice(product, selection))
    }

    @Test
    fun `starting price ignores unavailable sizes`() {
        val product = ApiJson.decodeFromString<ProductDto>(productJson).toDomain()
        // The Maxi size is unavailable, so it must not be offered; the cheapest available size is Klein.
        assertEquals(Money(700), product.startingPrice)
        assertTrue(product.hasMultipleSizes)
    }

    @Test
    fun `a pickup-only item is shown as unavailable for delivery`() {
        val dto = ApiJson.decodeFromString<ProductDto>(
            """{"id":"p","category_id":"c","name":"Pils","fulfillment":"pickup_only","portions":[{"key":"standard","label":"0,5 l","price_minor":200,"available":true}]}""",
        )
        val product = dto.toDomain()
        assertFalse(product.isAvailable)
        assertNull(product.startingPrice)
    }

    @Test
    fun `a list item that needs a choice cannot be added with the plus button`() {
        val listItem = ApiJson.decodeFromString<ProductDto>(
            """{"id":"p","category_id":"c","name":"Bolognese","needs_choices":true,"portions":[{"key":"standard","label":"Standard","price_minor":750}]}""",
        ).toDomain()
        assertTrue(listItem.customizationGroups.isEmpty()) // list responses carry no groups
        assertFalse(listItem.canQuickAdd)
        val plain = ApiJson.decodeFromString<ProductDto>(
            """{"id":"q","category_id":"c","name":"Pommes","portions":[{"key":"standard","label":"Standard","price_minor":300}]}""",
        ).toDomain()
        assertTrue(plain.canQuickAdd)
    }

    @Test
    fun `product with no available size is unavailable`() {
        val dto = ApiJson.decodeFromString<ProductDto>(
            """{"id":"p","category_id":"c","name":"X","portions":[{"key":"r","label":"R","price_minor":100,"available":false}]}""",
        )
        val product = dto.toDomain()
        assertNull(product.startingPrice)
        assertFalse(product.isAvailable)
    }

    @Test
    fun `missing optional fields get safe defaults`() {
        val product = ApiJson.decodeFromString<ProductDto>("""{"id":"p","category_id":"c","name":"X"}""").toDomain()
        assertEquals("", product.description)
        assertEquals(DietaryType.Veg, product.dietaryType)
        assertTrue(product.variants.isEmpty())
    }

    @Test
    fun `maps a category with its image`() {
        val category = ApiJson.decodeFromString<CategoryDto>("""{"id":"c1","name":"Pizza","slug":"pizza","image_url":"https://x/p.webp","sort_order":1}""").toDomain()
        assertEquals("Pizza", category.name)
        assertEquals("https://x/p.webp", category.imageUrl)
    }

    @Test
    fun `maps every documented order status`() {
        val wire = listOf("placed", "accepted", "preparing", "ready_for_dispatch", "out_for_delivery", "delivered", "rejected", "cancelled")
        val expected = listOf(
            OrderStatus.Placed, OrderStatus.Accepted, OrderStatus.Preparing, OrderStatus.ReadyForDispatch,
            OrderStatus.OutForDelivery, OrderStatus.Delivered, OrderStatus.Rejected, OrderStatus.Cancelled,
        )
        assertEquals(expected, wire.map { OrderStatus.fromWire(it) })
    }

    @Test
    fun `an unrecognised status does not crash the app`() {
        assertEquals(OrderStatus.Unknown, OrderStatus.fromWire("teleporting"))
        assertEquals(OrderStatus.Unknown, OrderStatus.fromWire(null))
    }

    @Test
    fun `maps an order and its money`() {
        val dto = ApiJson.decodeFromString<OrderDto>(
            """{"id":"o1","number":"CC-1048","status":"preparing","total_minor":64890,"currency":"EUR","created_at":"2026-10-16T19:42:00+05:30"}""",
        )
        val order = dto.toDomain()
        assertEquals("CC-1048", order.number)
        assertEquals(OrderStatus.Preparing, order.status)
        assertEquals(Money(64890), order.total)
    }

    @Test
    fun `decodes the assumed list envelope with and without a cursor`() {
        val page = ApiJson.decodeFromString<ListResponseDto<ProductDto>>("""{"items":[$productJson],"next_cursor":"abc"}""")
        assertEquals(1, page.items.size)
        assertEquals("abc", page.nextCursor)
        assertNull(ApiJson.decodeFromString<ListResponseDto<ProductDto>>("""{"items":[]}""").nextCursor)
    }

    @Test
    fun `maps a full order with lines, address and payment`() {
        val dto = ApiJson.decodeFromString<OrderDto>(
            """{"id":"o2","number":"CC-1051","status":"placed","total_minor":1500,"currency":"EUR","created_at":"2026-10-21T12:00:00Z",
                "subtotal_minor":2000,"discount_minor":500,"tax_minor":0,"delivery_fee_minor":0,"payment_method":"online_demo","estimated_minutes":45,
                "delivery_address":"Hohe Straße 12, Wesel-Mitte, 46483 Wesel","payment_status":"demo_paid",
                "lines":[{"name":"Salami","portion":"Groß 32 cm","options":["Champignons"],"quantity":2,"unit_price_minor":1000,"line_total_minor":2000}]}""",
        )
        val order = dto.toDomain()
        assertEquals(Money(1500), order.total)
        assertEquals(Money(500), order.discount)
        assertEquals(Money(2000), order.subtotal)
        assertEquals(45, order.estimatedMinutes)
        assertEquals(com.crustandco.customer.domain.PaymentMethod.OnlineDemo, order.paymentMethod)
        assertEquals("Hohe Straße 12, Wesel-Mitte, 46483 Wesel", order.deliveryAddress)
        assertEquals(1, order.lines.size)
        assertEquals("Salami", order.lines[0].name)
        assertEquals("Groß 32 cm", order.lines[0].variantName)
        assertEquals(listOf("Champignons"), order.lines[0].optionNames)
        assertEquals(Money(2000), order.lines[0].lineTotal)
    }

    @Test
    fun `an order from the list has no lines and no breakdown`() {
        val order = ApiJson.decodeFromString<OrderDto>(
            """{"id":"o3","number":"CC-1052","status":"delivered","total_minor":900,"currency":"EUR","created_at":"2026-10-20T10:00:00Z"}""",
        ).toDomain()
        assertTrue(order.lines.isEmpty())
        assertNull(order.subtotal)
        assertNull(order.paymentMethod)
    }

    @Test
    fun `maps an address and a quote`() {
        val address = ApiJson.decodeFromString<com.crustandco.customer.data.remote.AddressDto>(
            """{"id":"a1","label":"Home","line1":"Hohe Straße 12","locality":"Wesel-Mitte","city":"Wesel","postal_code":"46483","instructions":null,"is_default":true,"one_line":"x"}""",
        ).toDomain()
        assertEquals("Hohe Straße 12, Wesel-Mitte, Wesel 46483", address.oneLine)

        val quote = ApiJson.decodeFromString<com.crustandco.customer.data.remote.QuoteDto>(
            """{"currency":"EUR","lines":[],"subtotal_minor":2000,"discount_minor":500,"tax_minor":0,"delivery_fee_minor":0,"total_minor":1500,"coupon_code":"WELCOME5","delivery":{"minimum_order_minor":1000}}""",
        ).toDomain()
        assertEquals(Money(1500), quote.total)
        assertEquals(Money(500), quote.discount)
        assertEquals("WELCOME5", quote.couponCode)
    }

    @Test
    fun `a request carries ids and quantities only, never a price`() {
        val body = com.crustandco.customer.data.remote.CheckoutBody(
            idempotencyKey = "key-12345678", addressId = "a1", paymentMethod = "cod",
            items = listOf(com.crustandco.customer.domain.CheckoutItem("p1", "gross", listOf("o1"), 2).toBody()),
        )
        val json = ApiJson.encodeToString(com.crustandco.customer.data.remote.CheckoutBody.serializer(), body)
        assertTrue(json.contains("\"portion_key\":\"gross\""))
        assertTrue(json.contains("\"quantity\":2"))
        assertFalse(json.contains("price"))
        assertFalse(json.contains("coupon_code")) // omitted when null
    }
}
