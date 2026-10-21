package com.crustandco.customer.core

/** Outcome of a repository call. Repositories never throw for expected failures; they return [AppResult.Failure]. */
sealed interface AppResult<out T> {
    data class Success<T>(val data: T) : AppResult<T>
    data class Failure(val error: AppError) : AppResult<Nothing>
}

inline fun <T, R> AppResult<T>.map(transform: (T) -> R): AppResult<R> = when (this) {
    is AppResult.Success -> AppResult.Success(transform(data))
    is AppResult.Failure -> this
}

/**
 * Failures the UI can explain. Messages say what happened and what to do, and never leak server internals.
 * HTTP statuses follow docs/api-contract.md: 400, 401, 403, 404, 409, 429, 500.
 */
sealed interface AppError {
    val userMessage: String

    data object Network : AppError {
        override val userMessage = "Can’t reach the server. Check your connection and try again."
    }

    data object Unauthorized : AppError {
        override val userMessage = "Your session has ended. Sign in again to continue."
    }

    data object Forbidden : AppError {
        override val userMessage = "You don’t have permission to do that."
    }

    data object NotFound : AppError {
        override val userMessage = "We couldn’t find that. It may have been removed."
    }

    /** 400. [serverMessage] comes from the API's error envelope and is safe to show. */
    data class Validation(val code: String?, val serverMessage: String?) : AppError {
        override val userMessage = serverMessage ?: "Some details aren’t right. Check them and try again."
    }

    /** 409: invalid status transition, idempotency conflict, etc. */
    data class Conflict(val code: String?, val serverMessage: String?) : AppError {
        override val userMessage = serverMessage ?: "That action conflicts with the current state. Refresh and try again."
    }

    /** The live server doesn't offer this yet (its contract isn't final). Not a failure the customer can fix. */
    data object NotAvailable : AppError {
        override val userMessage = "This isn’t available yet. Try again in a later update."
    }

    data object RateLimited : AppError {
        override val userMessage = "Too many attempts. Wait a moment and try again."
    }

    data object Server : AppError {
        override val userMessage = "Something went wrong on our side. Try again in a moment."
    }

    data class Unknown(val detail: String? = null) : AppError {
        override val userMessage = "Something unexpected happened. Try again."
    }
}
