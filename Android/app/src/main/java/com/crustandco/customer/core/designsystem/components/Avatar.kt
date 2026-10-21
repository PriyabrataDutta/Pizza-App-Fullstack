package com.crustandco.customer.core.designsystem.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil3.compose.AsyncImage
import com.crustandco.customer.core.designsystem.Palette
import com.crustandco.customer.domain.UserProfile

/** Round profile picture. Shows the Google photo when there is one, otherwise warm gradient initials. */
@Composable
fun Avatar(user: UserProfile, modifier: Modifier = Modifier, size: Dp = 64.dp) {
    Box(
        modifier
            .size(size)
            .clip(CircleShape)
            .background(Brush.linearGradient(listOf(Palette.Red600, Palette.Amber400))),
        contentAlignment = Alignment.Center,
    ) {
        if (user.photoUrl != null) {
            AsyncImage(model = user.photoUrl, contentDescription = null, modifier = Modifier.fillMaxSize(), contentScale = ContentScale.Crop)
        } else {
            Text(
                user.initials,
                style = MaterialTheme.typography.headlineMedium.copy(fontSize = (size.value * 0.36f).sp),
                color = MaterialTheme.colorScheme.onPrimary,
            )
        }
    }
}
