set -a
source .env
set +a
set -e
NAMESPACE=openmeet-platform-dev

aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin   433321780850.dkr.ecr.us-east-1.amazonaws.com


docker buildx build --load \
  --build-arg APP_VERSION=$(node -p "require('./package.json').version") \
  --build-arg COMMIT_SHA=$(git rev-parse HEAD) \
  -t openmeet-platform:test .

# tag and push to ECR
docker tag openmeet-platform:test 433321780850.dkr.ecr.us-east-1.amazonaws.com/openmeet-ecr/openmeet-platform:test
docker push 433321780850.dkr.ecr.us-east-1.amazonaws.com/openmeet-ecr/openmeet-platform:test

# get the image digest
DIGEST=$(docker inspect --format='{{index .RepoDigests 0}}' 433321780850.dkr.ecr.us-east-1.amazonaws.com/openmeet-ecr/openmeet-platform:test)

# update deployment
kubectl set image -n $NAMESPACE deployment/openmeet-platform openmeet-platform=$DIGEST
kubectl rollout status deployment openmeet-platform -n $NAMESPACE
