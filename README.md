# OpenMeet (openmeet)

Building Communities

## Install the dependencies
```bash
yarn
# or
npm install
```

### Copy the environment variables and set the values
```bash
cp .env.example .env
```

### Start the app in development mode (hot-code reloading, error reporting, etc.)
```bash
yarn dev
# or
npm run dev
```


### Lint the files
```bash
yarn lint
# or
npm run lint
```



### Build the app for production
```bash
yarn build
# or
npm run build
```

### Test the app
```bash
yarn test
# or
npm run test
```

### Adding variables to the build
  - Add to .env
  - Add to quasar.config.ts (env section)
  - Add to Dockerfile (window.APP_CONFIG section)


### Customize the configuration
See [Configuring quasar.config.js](https://v2.quasar.dev/quasar-cli-vite/quasar-config-js).

`/public/config.json` is configuration for the app.  In k8s we load it from the configmap at runtime, and in `npm run dev` it is served and loaded from `https://.../config.json`


## Running end to end tests

```bash
# edit the .env file to set the correct APP_TESTING_API_URL
# following env.example

npm run test:e2e

# run against the public site
npx cypress run --config baseUrl=https://platform-devopenmeet.net
```
