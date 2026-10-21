package com.crustandco.customer.data.remote

import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Path
import retrofit2.http.Query

/**
 * Endpoints from docs/api-contract.md that Phase 1 consumes. Paths are exactly those in the contract (base path /api).
 * Addresses, coupons and checkout are added in Phase 2 once their schemas are final.
 */
interface CrustApi {
    /** Changes whenever the menu is edited. */
    @GET("menu/version")
    suspend fun menuVersion(): MenuVersionDto

    @GET("categories")
    suspend fun categories(): ListResponseDto<CategoryDto>

    @GET("products")
    suspend fun products(
        @Query("category") category: String? = null,
        @Query("search") search: String? = null,
        @Query("cursor") cursor: String? = null,
        @Query("limit") limit: Int? = null,
    ): ListResponseDto<ProductDto>

    @GET("products/{id}")
    suspend fun product(@Path("id") id: String): ProductDto

    /** First call of a new install: returns the private device token (shown once) that every customer call sends afterwards. */
    @POST("customers/guest")
    suspend fun registerGuest(): GuestDto

    @GET("addresses")
    suspend fun addresses(): ListResponseDto<AddressDto>

    @POST("addresses")
    suspend fun addAddress(@Body body: NewAddressBody): AddressDto

    @POST("pricing/quote")
    suspend fun quote(@Body body: QuoteBody): QuoteDto

    @POST("checkout")
    suspend fun checkout(@Body body: CheckoutBody): OrderDto

    @GET("orders")
    suspend fun orders(): ListResponseDto<OrderDto>

    @GET("orders/{id}")
    suspend fun order(@Path("id") id: String): OrderDto
}
