package com.crustandco.customer.feature.addresses

import com.crustandco.customer.core.designsystem.components.CrustCard
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import com.crustandco.customer.LocalAppContainer
import com.crustandco.customer.core.UiState
import com.crustandco.customer.core.designsystem.components.CrustTopBar
import com.crustandco.customer.core.designsystem.components.EmptyState
import com.crustandco.customer.core.designsystem.components.ErrorState
import com.crustandco.customer.core.designsystem.components.LoadingState
import com.crustandco.customer.core.designsystem.components.PrimaryButton
import com.crustandco.customer.domain.Address

@Composable
fun AddressesScreen(contentPadding: PaddingValues, onBack: () -> Unit) {
    val container = LocalAppContainer.current
    val viewModel: AddressesViewModel = viewModel(
        factory = viewModelFactory { initializer { AddressesViewModel(container.addressRepository) } },
    )
    val state by viewModel.state.collectAsStateWithLifecycle()
    var formOpen by rememberSaveable { mutableStateOf(false) }

    Column(Modifier.fillMaxSize().padding(top = contentPadding.calculateTopPadding())) {
        CrustTopBar(title = "My Addresses", onBack = onBack)

        when (val result = state.addresses) {
            UiState.Loading -> LoadingState(label = "Loading addresses")
            is UiState.Error -> ErrorState(result.error, onRetry = viewModel::retry)
            is UiState.Success -> LazyColumn(
                modifier = Modifier.weight(1f),
                contentPadding = PaddingValues(start = 20.dp, end = 20.dp, top = 8.dp, bottom = 16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                if (result.data.isEmpty()) {
                    item { EmptyState("No saved addresses", "Add where you’d like your food delivered.") }
                } else {
                    items(result.data, key = { it.id }) { AddressCard(it) }
                }
            }
        }

        if (state.addresses is UiState.Success) {
            Column(Modifier.padding(start = 20.dp, end = 20.dp, top = 8.dp, bottom = 12.dp + contentPadding.calculateBottomPadding())) {
                PrimaryButton("Add New Address", onClick = { formOpen = true }, modifier = Modifier.fillMaxWidth())
            }
        }
    }

    if (formOpen) {
        AddressFormSheet(
            saving = state.saving,
            serverError = state.saveError,
            onSave = { viewModel.add(it) { formOpen = false } },
            onDismiss = {
                formOpen = false
                viewModel.clearSaveError()
            },
        )
    }
}

@Composable
private fun AddressCard(address: Address) {
    CrustCard(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(address.label, style = MaterialTheme.typography.titleMedium)
            Text(address.oneLine, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}
