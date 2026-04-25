use serde::{Deserialize, Serialize};

// Init payload sent from JS → Rust → native. Defaults favour the strictest
// child-directed configuration so that a caller that forgets a field still
// produces a COPPA/Families-Policy compliant session. Overriding any of
// these defaults from JS is deliberate and should be reviewed against the
// Google Play Families Policy Requirements.
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InitRequest {
    /// Platform-specific LevelPlay app key from the dashboard.
    pub app_key: String,
    /// Rewarded-video ad unit ID from the LevelPlay dashboard's
    /// Ads → Ad Units list. Empty string disables rewarded ads for the
    /// session — show calls return a "not-configured" response that the
    /// JS provider treats as a no-op.
    #[serde(default)]
    pub rewarded_ad_unit_id: String,
    /// Interstitial ad unit ID from the LevelPlay dashboard. Same
    /// "empty = disabled" semantics as rewarded.
    #[serde(default)]
    pub interstitial_ad_unit_id: String,
    #[serde(default = "default_true")]
    pub is_child_directed: bool,
    /// AdMob "Tag For Child-directed Treatment" — mirrors is_child_directed
    /// at the AdMob adapter level so COPPA flows through to Google's ad
    /// stack even when AdMob is the winning bidder.
    #[serde(default = "default_true")]
    pub admob_tfcd: bool,
    /// AdMob "Tag For Users under Age of consent" — GDPR-K (EU under-16)
    /// equivalent. Required alongside TFCD for EU traffic on a kids app.
    #[serde(default = "default_true")]
    pub admob_tfua: bool,
    /// If true, LevelPlay does not collect the Android advertising ID /
    /// IDFA. Required for the Play Store Families Policy and for apps in
    /// Apple's Kids Category.
    #[serde(default = "default_true")]
    pub device_id_opt_out: bool,
    /// Meta Audience Network "mixed audience" — must be false on a kids
    /// app so Meta treats the traffic as strictly child-directed.
    #[serde(default = "default_false")]
    pub meta_mixed_audience: bool,
    /// Debug-only: launches LevelPlay's Integration Helper / Test Suite
    /// from the native side so we can validate adapter setup on a signed
    /// debug APK. Never enable in release builds.
    #[serde(default)]
    pub enable_test_suite: bool,
}

fn default_true() -> bool {
    true
}
fn default_false() -> bool {
    false
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InitResponse {
    pub initialized: bool,
}

#[derive(Debug, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ShowAdResponse {
    pub shown: bool,
    #[serde(default)]
    pub rewarded: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

/// Result of a `launch_test_suite` invocation. `launched=true` means
/// LevelPlay's debug overlay was opened over the running app. `launched=false`
/// + populated `error` means the SDK refused (e.g. `is_test_suite=enable`
/// metadata was not set at init time, or the platform is desktop).
#[derive(Debug, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LaunchTestSuiteResponse {
    pub launched: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}
