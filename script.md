# Intro

- Intro self

- Intro the application we will be building

  - Possibilities with this setup: air.me/nathanpeck
  - https://s3.amazonaws.com/airtime-opengraph-assets/production/users/55a4046530276e639920a401/opengraph.jpg?updatedAt=1557243929004

- Intro the concepts of the AWS Cloud Development Kit

# Build placeholders for deployment

- Show code for api-placeholder and run it directly on host

- Show code for worker-placeholder and run it directly on host

- Show Dockerfile for api-placeholder, build container, and run locally:
    docker build .
    docker run -d -p 3000 -e PORT=3000 <image ID from previous statement>
    docker ps
    curl localhost:<randomly assigned port>
    docker logs <container name>

- Show Dockerfile for worker-placeholder, build container, and run locally:
    docker build .
    docker run -d <image ID from previous statement>
    docker ps
    docker logs <container name>

# Create basic CDK structure: (app.1.js)

- Three stacks: one for base resources, one for API, one for worker

- Show output of `npm synth` in synth folder

- Show output of `npm diff`

- Run `npm deploy`

- Show deployed resources in console

# Add placeholder apps into the CDK structure (app.2.js)

- Add placeholder apps into the API stack and worker stack

- Show output of `npm diff` again

- Run `npm deploy`

- Show all the deployed resources, verify that API responds, show logs in ECS console

# Deploying the actual app (app.3.js)

- Show code for the real API

- Show code for the real worker

- Add resources to the base template

- Add permissions to the API and worker, switch code over
