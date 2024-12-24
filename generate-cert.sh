#!/bin/bash

# Generate private key and certificate
openssl req -x509 -newkey rsa:4096 -sha256 -days 365 -nodes \
  -keyout key.pem -out cert.pem \
  -subj "/CN=local.openmeet.net" \
  -addext "subjectAltName=DNS:local.openmeet.net,DNS:localhost,DNS:local.openmeet.net:9005,DNS:local.openmeet.net:3000"

# Verify the files were created with proper PEM format
echo "Verifying certificate:"
openssl x509 -in cert.pem -text -noout > /dev/null
if [ $? -eq 0 ]; then
    echo "Certificate is valid"
else
    echo "Certificate is invalid"
fi

echo "Verifying private key:"
openssl rsa -in key.pem -check > /dev/null
if [ $? -eq 0 ]; then
    echo "Private key is valid"
else
    echo "Private key is invalid"
fi
