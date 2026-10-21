package com.crustandco.customer.data

import com.crustandco.customer.core.AppError
import com.crustandco.customer.core.AppResult
import com.crustandco.customer.data.remote.apiCall
import com.crustandco.customer.data.remote.toAppError
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.test.runTest
import kotlinx.serialization.SerializationException
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.ResponseBody.Companion.toResponseBody
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test
import retrofit2.HttpException
import retrofit2.Response
import java.io.IOException

class ApiCallTest {
    private fun http(code: Int, body: String = ""): HttpException =
        HttpException(Response.error<Any>(code, body.toResponseBody("application/json".toMediaType())))

    private val envelope = """{"error":{"code":"VALIDATION_ERROR","message":"Quantity must be at least 1","details":[]}}"""

    @Test
    fun `400 keeps the server's code and message from the error envelope`() {
        val error = http(400, envelope).toAppError()
        assertEquals(AppError.Validation("VALIDATION_ERROR", "Quantity must be at least 1"), error)
        assertEquals("Quantity must be at least 1", error.userMessage)
    }

    @Test
    fun `maps each documented status to a stable error`() {
        assertEquals(AppError.Unauthorized, http(401).toAppError())
        assertEquals(AppError.Forbidden, http(403).toAppError())
        assertEquals(AppError.NotFound, http(404).toAppError())
        assertEquals(AppError.RateLimited, http(429).toAppError())
        assertEquals(AppError.Server, http(500).toAppError())
        assertEquals(AppError.Server, http(503).toAppError())
    }

    @Test
    fun `409 conflict carries the server message`() {
        val body = """{"error":{"code":"INVALID_TRANSITION","message":"Order already accepted"}}"""
        assertEquals(AppError.Conflict("INVALID_TRANSITION", "Order already accepted"), http(409, body).toAppError())
    }

    @Test
    fun `a malformed or empty error body still maps by status and never crashes`() {
        assertEquals(AppError.Validation(null, null), http(400, "<html>oops</html>").toAppError())
        assertEquals(AppError.Validation(null, null), http(400, "").toAppError())
        assertTrue(AppError.Validation(null, null).userMessage.isNotBlank())
    }

    @Test
    fun `an unexpected status becomes Unknown`() {
        assertTrue(http(418).toAppError() is AppError.Unknown)
    }

    @Test
    fun `apiCall wraps success`() = runTest {
        assertEquals(AppResult.Success(7), apiCall { 7 })
    }

    @Test
    fun `apiCall maps HTTP failures`() = runTest {
        assertEquals(AppResult.Failure(AppError.NotFound), apiCall<Int> { throw http(404) })
    }

    @Test
    fun `apiCall maps IO failures to a network error`() = runTest {
        assertEquals(AppResult.Failure(AppError.Network), apiCall<Int> { throw IOException("offline") })
    }

    @Test
    fun `apiCall maps a broken payload to Unknown without leaking details to the user`() = runTest {
        val result = apiCall<Int> { throw SerializationException("bad json at $.items[0]") }
        val error = (result as AppResult.Failure).error
        assertTrue(error is AppError.Unknown)
        assertTrue(!error.userMessage.contains("items"))
    }

    @Test
    fun `apiCall never swallows cancellation`() = runTest {
        var rethrown: CancellationException? = null
        try {
            apiCall<Int> { throw CancellationException("cancelled") }
        } catch (e: CancellationException) {
            rethrown = e
        }
        assertNotNull("cancellation must propagate, not become a Failure", rethrown)
    }
}
