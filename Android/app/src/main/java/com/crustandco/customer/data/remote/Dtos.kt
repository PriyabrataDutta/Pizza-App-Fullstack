package com.crustandco.customer.data.remote

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

// PROVISIONAL DTOs.
// docs/api-contract.md lists endpoints but not final response schemas. Field names below follow the canonical
// column names in docs/database-schema.md (snake_case). Every assumption is listed in Android/docs/api-assumptions.md
// and must be confirmed against the contract Antigravity publishes. Changes stay inside this file and Mappers.kt.

/** Assumed list envelope for every list endpoint. */
@Serializable
data class ListResponseDto<T>(
    val items: List<T> = emptyList(),
    @SerialName("next_cursor") val nextCursor: String? = null,
)

@Serializable
data class MenuVersionDto(val version: Long)

@Serializable
data class CategoryDto(
    val id: String,
    @SerialName("parent_id") val parentId: String? = null,
    val name: String,
    @SerialName("image_url") val imageUrl: String? = null,
    @SerialName("icon_key") val iconKey: String? = null,
)

/** A size of a product. [key] is stable ("klein", "gross") and is what the app sends back as the variant id. */
@Serializable
data class PortionDto(
    val key: String,
    val label: String,
    @SerialName("price_minor") val priceMinor: Long,
    val available: Boolean = true,
)

@Serializable
data class OptionDto(
    val id: String,
    val name: String,
    @SerialName("is_default") val isDefault: Boolean = false,
    /** Extra price in minor units by portion key. Empty for free choices. */
    val prices: Map<String, Long> = emptyMap(),
)

@Serializable
data class GroupDto(
    val id: String,
    val name: String,
    val kind: String = "choice",
    val min: Int = 0,
    val max: Int = 1,
    val required: Boolean = false,
    val options: List<OptionDto> = emptyList(),
)

/** One shape for both list items (portions, no groups, needs_choices) and the detail (portions and groups). */
@Serializable
data class ProductDto(
    val id: String,
    @SerialName("category_id") val categoryId: String,
    val name: String,
    val description: String? = null,
    @SerialName("image_url") val imageUrl: String? = null,
    val diet: String = "veg",
    @SerialName("is_spicy") val isSpicy: Boolean = false,
    @SerialName("is_bestseller") val isBestseller: Boolean = false,
    val fulfillment: String = "delivery_and_pickup",
    val currency: String = "EUR",
    val portions: List<PortionDto> = emptyList(),
    val groups: List<GroupDto> = emptyList(),
    @SerialName("needs_choices") val needsChoices: Boolean = false,
)

@Serializable
data class OrderDto(
    val id: String,
    @SerialName("order_number") val orderNumber: String,
    val status: String,
    @SerialName("total_minor") val totalMinor: Long,
    val currency: String = "EUR",
    @SerialName("created_at") val createdAt: String,
)

/** Error envelope from docs/api-contract.md: { "error": { "code", "message", "details" } }. */
@Serializable
data class ErrorEnvelopeDto(val error: ErrorBodyDto? = null)

@Serializable
data class ErrorBodyDto(
    val code: String? = null,
    val message: String? = null,
)
