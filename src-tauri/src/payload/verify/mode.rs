use serde::Serialize;

#[derive(Debug, Clone, Copy)]
pub struct VerifyMode {
    pub layer3_enabled: bool,
    pub layer4_enabled: bool,
}

impl Default for VerifyMode {
    fn default() -> Self {
        Self { layer3_enabled: true, layer4_enabled: true }
    }
}

impl VerifyMode {
    pub fn layer3_enabled(&self) -> bool {
        self.layer3_enabled
    }

    pub fn layer4_enabled(&self) -> bool {
        self.layer4_enabled
    }
}

#[derive(Debug, Serialize, Clone)]
pub struct VerificationResult {
    pub success: bool,
    pub errors: Vec<String>,
}
