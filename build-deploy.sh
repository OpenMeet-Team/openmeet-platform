set -a
source .env
set +a

aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin   433321780850.dkr.ecr.us-east-1.amazonaws.com
docker build -t 433321780850.dkr.ecr.us-east-1.amazonaws.com/openmeet-ecr/openmeet-platform:test .
docker push 433321780850.dkr.ecr.us-east-1.amazonaws.com/openmeet-ecr/openmeet-platform:test
kubectl set image -n openmeet-platform-dev deployment/openmeet-platform openmeet-platform=433321780850.dkr.ecr.us-east-1.amazonaws.com/openmeet-ecr/openmeet-platform:test

#  433321780850.dkr.ecr.us-east-1.amazonaws.com/openmeet-ecr/openmeet-platform@sha256:0a6fd62f4e85c10ff9ad6f1dfb8cf40c22fd1dbbffcfe2efb8abc0df8815c0e7 
