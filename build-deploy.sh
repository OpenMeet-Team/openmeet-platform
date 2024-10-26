set -a
source .env
set +a

aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin   433321780850.dkr.ecr.us-east-1.amazonaws.com

docker build \
  --build-arg APP_TENANT_ID=1 \
  --build-arg APP_HUBSPOT_PORTAL_ID=47380304 \
  --build-arg APP_HUBSPOT_FORM_ID=7aa8f331-96a9-48ec-a787-0c894dc5f85e \
  -t openmeet-platform:test .

# tag and push to ECR
docker tag openmeet-platform:test 433321780850.dkr.ecr.us-east-1.amazonaws.com/openmeet-ecr/openmeet-platform:test
docker push 433321780850.dkr.ecr.us-east-1.amazonaws.com/openmeet-ecr/openmeet-platform:test

# get the image digest
DIGEST=$(docker inspect --format='{{index .RepoDigests 0}}' 433321780850.dkr.ecr.us-east-1.amazonaws.com/openmeet-ecr/openmeet-platform:test)

# update deployment
kubectl set image -n openmeet-platform-dev deployment/openmeet-platform openmeet-platform=$DIGEST
