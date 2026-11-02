// Removes the dist folder, which holds every folder staged for installation.
// Run it with: deno task clean

export async function clean(dir = "dist"): Promise<boolean> {
  try {
    await Deno.remove(dir, { recursive: true });
    return true;
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) return false;
    throw error;
  }
}

if (import.meta.main) {
  console.log((await clean()) ? "Removed dist" : "No dist folder to remove");
}
