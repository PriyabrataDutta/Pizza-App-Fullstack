package com.crustandco.customer.data.remote

import com.crustandco.customer.core.AppError
import com.crustandco.customer.core.AppResult
import kotlinx.coroutines.CancellationException
import kotlinx.serialization.SerializationException
import kotlinx.serialization.json.Json
import retrofit2.HttpException
import java.io.IOException

/** Runs a Retrofit call and converts every expected failure into [AppResult.Failure]. Cancellation is rethrown. */
suspend fun <T> apiCall(json: Json = ApiJson, block: suspend () -> T): AppResult<T> =
    try {
        AppResult.Success(block())
    } catch (e: CancellationException) {
        throw e
    } catch (e: HttpException) {
        AppResult.Failure(e.toAppError(json))
    } catch (e: IOException) {
        AppResult.Failure(AppError.Network)
    } catch (e: SerializationException) {
        AppResult.Failure(AppError.Unknown("Unexpected response shape"))
    }

/** Maps an HTTP error to a stable [AppError], reading the contract's error envelope when present. */
fun HttpException.toAppError(json: Json = ApiJson): AppError {
    val body = runCatching {
        val raw = response()?.errorBody()?.string()
        if (raw.isNullOrBlank()) null else json.decodeFromString<ErrorEnvelopeDto>(raw).error
    }.getOrNull()

    return when (code()) {
        400, 422 -> AppError.Validation(body?.code, body?.message)
        401 -> AppError.Unauthorized
        403 -> AppError.Forbidden
        404 -> AppError.NotFound
        409 -> AppError.Conflict(body?.code, body?.message)
        429 -> AppError.RateLimited
        in 500..599 -> AppError.Server
        else -> AppError.Unknown("HTTP ${code()}")
    }
}
