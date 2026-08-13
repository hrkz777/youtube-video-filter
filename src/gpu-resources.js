const PIPELINE_RESOURCE_FIELDS = [
  "outputTexture",
  "texture",
  "strengthBuffer",
  "strengthBuffer2"
];

function destroyResource(resource, excludedResources, destroyedResources) {
  if (!resource
    || excludedResources.has(resource)
    || destroyedResources.has(resource)
    || typeof resource.destroy !== "function") {
    return;
  }
  destroyedResources.add(resource);
  resource.destroy();
}

function visitPipeline(pipeline, excludedResources, visitedPipelines, destroyedResources) {
  if (!pipeline || typeof pipeline !== "object" || visitedPipelines.has(pipeline)) return;
  visitedPipelines.add(pipeline);

  if (Array.isArray(pipeline.pipelines)) {
    for (const child of pipeline.pipelines) {
      visitPipeline(child, excludedResources, visitedPipelines, destroyedResources);
    }
  }

  if (Array.isArray(pipeline.textures)) {
    for (const texture of pipeline.textures) {
      destroyResource(texture, excludedResources, destroyedResources);
    }
  }

  for (const field of PIPELINE_RESOURCE_FIELDS) {
    destroyResource(pipeline[field], excludedResources, destroyedResources);
  }
}

export function destroyAnime4kPipelineResources(pipelines, excludedResources = []) {
  const excluded = new Set(excludedResources);
  const visitedPipelines = new Set();
  const destroyedResources = new Set();
  for (const pipeline of pipelines) {
    visitPipeline(pipeline, excluded, visitedPipelines, destroyedResources);
  }
  return destroyedResources.size;
}
