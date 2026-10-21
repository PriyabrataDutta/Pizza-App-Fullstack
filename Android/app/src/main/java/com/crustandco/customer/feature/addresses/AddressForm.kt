package com.crustandco.customer.feature.addresses

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import com.crustandco.customer.core.designsystem.components.PrimaryButton
import com.crustandco.customer.domain.NewAddress

/** Add-address form in a bottom sheet. Checks fields before sending and shows the server's reason if it still says no. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AddressFormSheet(
    saving: Boolean,
    serverError: String?,
    onSave: (NewAddress) -> Unit,
    onDismiss: () -> Unit,
) {
    var label by rememberSaveable { mutableStateOf("") }
    var line1 by rememberSaveable { mutableStateOf("") }
    var locality by rememberSaveable { mutableStateOf("") }
    var city by rememberSaveable { mutableStateOf("Wesel") }
    var postalCode by rememberSaveable { mutableStateOf("") }
    var showErrors by rememberSaveable { mutableStateOf(false) }

    val draft = NewAddress(label, line1, locality, city, postalCode)
    val problems = if (showErrors) draft.validate() else emptyMap()

    ModalBottomSheet(onDismissRequest = onDismiss, containerColor = MaterialTheme.colorScheme.background) {
        Column(
            Modifier.fillMaxWidth().verticalScroll(rememberScrollState()).padding(horizontal = 20.dp).padding(bottom = 28.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Text("Add New Address", style = MaterialTheme.typography.headlineMedium)
            Field("Name (Home, Office…)", label, { label = it }, problems["label"])
            Field("Flat, building, street", line1, { line1 = it }, problems["line1"])
            Field("Area or locality", locality, { locality = it }, problems["locality"])
            Field("City", city, { city = it }, problems["city"])
            Field("Postcode (PLZ)", postalCode, { postalCode = it.filter(Char::isDigit).take(5) }, problems["postalCode"], KeyboardType.Number, ImeAction.Done)
            if (serverError != null) Text(serverError, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.error)
            PrimaryButton(
                text = "Save address",
                onClick = {
                    showErrors = true
                    if (draft.validate().isEmpty()) onSave(draft)
                },
                loading = saving,
                modifier = Modifier.fillMaxWidth().heightIn(min = 52.dp),
            )
        }
    }
}

@Composable
private fun Field(
    label: String,
    value: String,
    onChange: (String) -> Unit,
    error: String?,
    keyboardType: KeyboardType = KeyboardType.Text,
    ime: ImeAction = ImeAction.Next,
) {
    OutlinedTextField(
        value = value,
        onValueChange = onChange,
        modifier = Modifier.fillMaxWidth(),
        singleLine = true,
        label = { Text(label) },
        isError = error != null,
        supportingText = { if (error != null) Text(error) },
        keyboardOptions = KeyboardOptions(keyboardType = keyboardType, imeAction = ime),
        shape = MaterialTheme.shapes.medium,
    )
}
