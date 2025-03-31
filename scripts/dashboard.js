export function dashboardComponent(mainAppInterface) {
    const { createApp, ref, onMounted } = Vue; // Removed computed as it's not used here

    return createApp({
        setup() {
            // Basic ref to ensure setup runs
            const componentName = ref('Dashboard');

            onMounted(() => {
                console.log("Simplified Dashboard Component Mounted");
                // You could still fetch data here if needed, but template is minimal
            });

            // Return only what the minimal template needs (nothing in this case)
            return {
                componentName // Just to show setup ran
            };
        },
        // VERY Simple Template for testing visibility
        template: `
            <div style="background-color: #333; padding: 40px; border: 5px solid lime; margin: 20px;">
              <h1 style="color: lime; font-size: 3rem; text-align: center;">
                DASHBOARD TEST CONTENT VISIBLE
              </h1>
              <p style="color: white; text-align: center;">If you see this, the dashboard component is mounting and rendering basic HTML.</p>
            </div>
        `
    });
}