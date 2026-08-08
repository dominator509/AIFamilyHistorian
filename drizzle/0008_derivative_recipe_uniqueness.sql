create unique index if not exists derivative_objects_recipe_idx
  on derivative_objects(original_object_id, recipe_version);
