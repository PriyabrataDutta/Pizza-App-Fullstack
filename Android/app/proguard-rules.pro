# kotlinx.serialization keeps generated serializers; these rules cover Retrofit service interfaces and DTOs.
-keepattributes *Annotation*, InnerClasses, Signature, RuntimeVisibleAnnotations
-keep,includedescriptorclasses class com.crustandco.customer.**$$serializer { *; }
-keepclassmembers class com.crustandco.customer.** {
    *** Companion;
}
-keepclasseswithmembers class com.crustandco.customer.** {
    kotlinx.serialization.KSerializer serializer(...);
}
-keep interface com.crustandco.customer.data.remote.CrustApi
-dontwarn org.codehaus.mojo.animal_sniffer.IgnoreJRERequirement
