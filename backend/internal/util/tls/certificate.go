package tls

import (
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/pem"
	"fmt"
	"math/big"
	"net"
	"os"
	"path/filepath"
	"time"
)

const (
	certFileName = "server.crt"
	keyFileName  = "server.key"
)

// CertificateManager handles TLS certificate generation and management
type CertificateManager struct {
	certsDir string
}

// NewCertificateManager creates a new certificate manager
func NewCertificateManager(certsDir string) *CertificateManager {
	return &CertificateManager{
		certsDir: certsDir,
	}
}

// EnsureCertificates checks if certificates exist, and generates them if they don't
// Returns paths to cert and key files
func (cm *CertificateManager) EnsureCertificates() (certPath, keyPath string, err error) {
	certPath = filepath.Join(cm.certsDir, certFileName)
	keyPath = filepath.Join(cm.certsDir, keyFileName)

	// Check if certificates already exist
	if cm.certificatesExist(certPath, keyPath) {
		return certPath, keyPath, nil
	}

	// Create certificates directory if it doesn't exist
	if err := os.MkdirAll(cm.certsDir, 0755); err != nil {
		return "", "", fmt.Errorf("failed to create certificates directory: %w", err)
	}

	// Generate new self-signed certificates
	if err := cm.generateSelfSignedCert(certPath, keyPath); err != nil {
		return "", "", fmt.Errorf("failed to generate self-signed certificate: %w", err)
	}

	return certPath, keyPath, nil
}

// certificatesExist checks if both cert and key files exist
func (cm *CertificateManager) certificatesExist(certPath, keyPath string) bool {
	if _, err := os.Stat(certPath); os.IsNotExist(err) {
		return false
	}
	if _, err := os.Stat(keyPath); os.IsNotExist(err) {
		return false
	}
	return true
}

// generateSelfSignedCert generates a self-signed certificate and private key
func (cm *CertificateManager) generateSelfSignedCert(certPath, keyPath string) error {
	// Generate private key using ECDSA (faster and smaller than RSA)
	privateKey, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		return fmt.Errorf("failed to generate private key: %w", err)
	}

	// Create certificate template
	serialNumber, err := rand.Int(rand.Reader, new(big.Int).Lsh(big.NewInt(1), 128))
	if err != nil {
		return fmt.Errorf("failed to generate serial number: %w", err)
	}

	notBefore := time.Now()
	notAfter := notBefore.Add(10 * 365 * 24 * time.Hour) // Valid for 10 years

	template := x509.Certificate{
		SerialNumber: serialNumber,
		Subject: pkix.Name{
			Organization:  []string{"Postgresus"},
			Country:       []string{"US"},
			Province:      []string{""},
			Locality:      []string{""},
			StreetAddress: []string{""},
			PostalCode:    []string{""},
			CommonName:    "Postgresus Self-Signed Certificate",
		},
		NotBefore:             notBefore,
		NotAfter:              notAfter,
		KeyUsage:              x509.KeyUsageKeyEncipherment | x509.KeyUsageDigitalSignature,
		ExtKeyUsage:           []x509.ExtKeyUsage{x509.ExtKeyUsageServerAuth},
		BasicConstraintsValid: true,
		IsCA:                  false,
	}

	// Add DNS names and IP addresses
	template.DNSNames = []string{
		"localhost",
		"postgresus",
		"postgresus.local",
	}
	template.IPAddresses = []net.IP{
		net.IPv4(127, 0, 0, 1),
		net.IPv6loopback,
		net.IPv4(0, 0, 0, 0), // Allow any IP
	}

	// Create certificate
	derBytes, err := x509.CreateCertificate(rand.Reader, &template, &template, &privateKey.PublicKey, privateKey)
	if err != nil {
		return fmt.Errorf("failed to create certificate: %w", err)
	}

	// Save certificate
	certOut, err := os.Create(certPath)
	if err != nil {
		return fmt.Errorf("failed to create cert file: %w", err)
	}
	defer certOut.Close()

	if err := pem.Encode(certOut, &pem.Block{Type: "CERTIFICATE", Bytes: derBytes}); err != nil {
		return fmt.Errorf("failed to write certificate: %w", err)
	}

	// Save private key
	keyOut, err := os.OpenFile(keyPath, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, 0600)
	if err != nil {
		return fmt.Errorf("failed to create key file: %w", err)
	}
	defer keyOut.Close()

	privBytes, err := x509.MarshalECPrivateKey(privateKey)
	if err != nil {
		return fmt.Errorf("failed to marshal private key: %w", err)
	}

	if err := pem.Encode(keyOut, &pem.Block{Type: "EC PRIVATE KEY", Bytes: privBytes}); err != nil {
		return fmt.Errorf("failed to write private key: %w", err)
	}

	return nil
}

// GetCertificatePaths returns paths to existing certificates
func (cm *CertificateManager) GetCertificatePaths() (certPath, keyPath string) {
	return filepath.Join(cm.certsDir, certFileName), filepath.Join(cm.certsDir, keyFileName)
}
