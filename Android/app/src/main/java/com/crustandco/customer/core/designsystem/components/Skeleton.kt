package com.crustandco.customer.core.designsystem.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.crustandco.customer.core.designsystem.shimmerBrush

// Skeletons show the shape of what's loading, with a soft moving highlight. They feel faster than a spinner and keep the
// layout from jumping when content arrives. A single spoken label replaces the visual noise for screen readers.

@Composable
fun ShimmerBox(modifier: Modifier = Modifier, corner: Dp = 12.dp) {
    Box(modifier.clip(RoundedCornerShape(corner)).background(shimmerBrush()))
}

@Composable
fun ProductRowSkeleton(modifier: Modifier = Modifier) {
    CrustCard(modifier.fillMaxWidth(), elevation = 0.dp) {
        Row(Modifier.padding(10.dp), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            ShimmerBox(Modifier.size(92.dp), corner = 14.dp)
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                ShimmerBox(Modifier.fillMaxWidth(0.6f).height(18.dp))
                ShimmerBox(Modifier.fillMaxWidth().height(12.dp))
                ShimmerBox(Modifier.fillMaxWidth(0.7f).height(12.dp))
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    ShimmerBox(Modifier.width(80.dp).height(20.dp))
                    ShimmerBox(Modifier.size(36.dp), corner = 12.dp)
                }
            }
        }
    }
}

@Composable
fun ProductTileSkeleton(modifier: Modifier = Modifier) {
    CrustCard(modifier.fillMaxWidth(), elevation = 0.dp) {
        Column(Modifier.padding(10.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            ShimmerBox(Modifier.fillMaxWidth().aspectRatio(1.2f), corner = 14.dp)
            ShimmerBox(Modifier.fillMaxWidth(0.7f).height(18.dp))
            ShimmerBox(Modifier.fillMaxWidth().height(12.dp))
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                ShimmerBox(Modifier.width(70.dp).height(20.dp))
                ShimmerBox(Modifier.size(36.dp), corner = 12.dp)
            }
        }
    }
}

/** A column of [count] row skeletons, announced once as "Loading". */
@Composable
fun ProductListSkeleton(label: String, count: Int = 4, modifier: Modifier = Modifier) {
    Column(modifier.semantics { contentDescription = label }, verticalArrangement = Arrangement.spacedBy(12.dp)) {
        repeat(count) { ProductRowSkeleton() }
    }
}
