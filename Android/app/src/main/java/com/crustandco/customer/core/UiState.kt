package com.crustandco.customer.core

/** Standard screen/section state. Loading and error never look like success. */
sealed interface UiState<out T> {
    data object Loading : UiState<Nothing>
    data class Error(val error: AppError) : UiState<Nothing>
    data class Success<T>(val data: T) : UiState<T>
}

fun <T> AppResult<T>.toUiState(): UiState<T> = when (this) {
    is AppResult.Success -> UiState.Success(data)
    is AppResult.Failure -> UiState.Error(error)
}
