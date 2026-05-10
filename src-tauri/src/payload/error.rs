use std::fmt;

#[allow(dead_code)]
#[derive(Debug)]
pub enum PayloadError {
    Io(String),
    Decompression(String),
    HashMismatch { expected: String, actual: String },
    Http(String),
    Parse(String),
    Crypto(String),
    InvalidPayload(String),
    Other(String),
}

impl fmt::Display for PayloadError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            PayloadError::Io(s) => write!(f, "I/O error: {s}"),
            PayloadError::Decompression(s) => write!(f, "Decompression error: {s}"),
            PayloadError::HashMismatch { expected, actual } => {
                write!(f, "Hash mismatch: expected {expected}, got {actual}")
            }
            PayloadError::Http(s) => write!(f, "HTTP error: {s}"),
            PayloadError::Parse(s) => write!(f, "Parse error: {s}"),
            PayloadError::Crypto(s) => write!(f, "Crypto error: {s}"),
            PayloadError::InvalidPayload(s) => write!(f, "Invalid payload: {s}"),
            PayloadError::Other(s) => write!(f, "{s}"),
        }
    }
}

impl From<std::io::Error> for PayloadError {
    fn from(e: std::io::Error) -> Self {
        PayloadError::Io(e.to_string())
    }
}

impl From<anyhow::Error> for PayloadError {
    fn from(e: anyhow::Error) -> Self {
        PayloadError::Other(e.to_string())
    }
}
