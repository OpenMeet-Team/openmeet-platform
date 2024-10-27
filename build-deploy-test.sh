set -a
source .env
set +a
set -e

aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin   433321780850.dkr.ecr.us-east-1.amazonaws.com

docker build \
  --build-arg APP_HUBSPOT_PORTAL_ID=47380304 \
  --build-arg APP_HUBSPOT_FORM_ID=7aa8f331-96a9-48ec-a787-0c894dc5f85e \
  -t openmeet-platform:test .

# tag and push to ECR
docker tag openmeet-platform:test 433321780850.dkr.ecr.us-east-1.amazonaws.com/openmeet-ecr/openmeet-platform:test
docker push 433321780850.dkr.ecr.us-east-1.amazonaws.com/openmeet-ecr/openmeet-platform:test

# get the image digest
DIGEST=$(docker inspect --format='{{index .RepoDigests 0}}' 433321780850.dkr.ecr.us-east-1.amazonaws.com/openmeet-ecr/openmeet-platform:test)

# working:  433321780850.dkr.ecr.us-east-1.amazonaws.com/openmeet-ecr/openmeet-platform@sha256:5dce0e1d11910e3631eca63ca1fcaf1de4ea960b57a24432127a9c2e114e4813
# update deployment
kubectl set image -n openmeet-platform-prod deployment/openmeet-platform openmeet-platform=$DIGEST
