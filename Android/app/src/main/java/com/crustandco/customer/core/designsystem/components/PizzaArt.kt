package com.crustandco.customer.core.designsystem.components

import androidx.compose.foundation.Canvas
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import com.crustandco.customer.core.designsystem.Palette

// Top-down pizza drawn in brand colors. Used until real photography is supplied; no image files, licensing or downloads.
// Coordinates are from a 200 x 200 design box and scaled to whatever size the composable gets.
private val Pepperoni = listOf(
    100f to 52f, 140f to 78f, 140f to 122f, 100f to 148f, 60f to 122f, 60f to 78f, 100f to 100f, 78f to 98f, 124f to 100f,
)
private val Basil = listOf(Triple(118f, 70f, 20f), Triple(82f, 128f, 200f), Triple(126f, 134f, 70f), Triple(74f, 72f, 140f))

@Composable
fun PizzaArt(modifier: Modifier = Modifier, description: String? = null) {
    val semanticModifier = if (description != null) modifier.semantics { contentDescription = description } else modifier
    Canvas(semanticModifier) {
        val unit = size.minDimension / 200f
        val center = Offset(size.width / 2f, size.height / 2f)
        fun at(x: Float, y: Float) = Offset(center.x + (x - 100f) * unit, center.y + (y - 100f) * unit)

        drawCircle(Palette.Crust400, radius = 96f * unit, center = center)
        drawCircle(Palette.Crust600, radius = 96f * unit, center = center, style = Stroke(width = 2f * unit))
        drawCircle(Palette.Cheese200, radius = 82f * unit, center = center)

        repeat(8) { i ->
            rotate(degrees = i * 45f + 22.5f, pivot = center) {
                drawLine(
                    color = Palette.Crust400,
                    start = center,
                    end = Offset(center.x, center.y - 82f * unit),
                    strokeWidth = 2f * unit,
                    cap = StrokeCap.Round,
                )
            }
        }

        Pepperoni.forEach { (x, y) ->
            val p = at(x, y)
            drawCircle(Palette.Red600, radius = 13f * unit, center = p)
            drawCircle(Palette.Red700, radius = 3f * unit, center = p + Offset(-3f * unit, -3f * unit))
            drawCircle(Palette.Red700, radius = 2.5f * unit, center = p + Offset(4f * unit, 3f * unit))
        }

        Basil.forEach { (x, y, degrees) ->
            val p = at(x, y)
            rotate(degrees = degrees, pivot = p) {
                drawOval(Palette.Green700, topLeft = Offset(p.x - 9f * unit, p.y - 5f * unit), size = Size(18f * unit, 10f * unit))
            }
        }
    }
}
