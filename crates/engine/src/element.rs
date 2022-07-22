use crate::{
    texture::{from_image, Texture},
    vertex::{Vertex, INDICES},
    wgpu_holder::WGPUHolder,
};
use quadtree::{rect::Rect, Spatial};
use wgpu::{util::DeviceExt, TextureView};

pub struct ImageElement {
    id: u32,
    texture: Option<Texture>,
    file_path: String,
    rect: Rect,
}

impl std::fmt::Debug for ImageElement {
    fn fmt(&self, formatter: &mut ::std::fmt::Formatter) -> ::std::fmt::Result {
        formatter
            .debug_struct("Branch")
            .field("id", &self.id)
            .field("rect", &self.rect)
            .finish()
    }
}

impl Spatial for ImageElement {
    fn aabb(&self) -> Rect {
        self.rect
    }
}

impl ImageElement {
    pub fn new(id: u32, file_path: String, rect: Rect) -> ImageElement {
        ImageElement {
            id,
            file_path,
            rect,
            texture: None,
        }
    }

    pub fn get_id(&self) -> u32 {
        self.id
    }

    pub fn submit(&mut self, canvas_area: &Rect, holder: &mut WGPUHolder, output: &TextureView) {
        if self.texture.is_none() {
            let image = image::open(self.file_path.clone()).unwrap();
            self.texture = Some(from_image(holder, &image, None));
        }

        let vertex = Vertex::get_vertex(
            &self.rect,
            canvas_area,
            self.texture.as_ref().unwrap().width,
            self.texture.as_ref().unwrap().height,
        );

        let mut encoder = holder
            .device
            .create_command_encoder(&wgpu::CommandEncoderDescriptor {
                label: Some("Render Encoder"),
            });
        let vertex_buffer = holder
            .device
            .create_buffer_init(&wgpu::util::BufferInitDescriptor {
                label: None,
                contents: bytemuck::cast_slice(vertex.as_slice()) as &[u8],
                usage: wgpu::BufferUsages::VERTEX,
            });
        let index_buffer = holder
            .device
            .create_buffer_init(&wgpu::util::BufferInitDescriptor {
                label: None,
                contents: bytemuck::cast_slice(INDICES) as &[u8],
                usage: wgpu::BufferUsages::INDEX,
            });
        let texture_bind_group_layout =
            holder
                .device
                .create_bind_group_layout(&wgpu::BindGroupLayoutDescriptor {
                    entries: &[
                        wgpu::BindGroupLayoutEntry {
                            binding: 0,
                            visibility: wgpu::ShaderStages::FRAGMENT,
                            ty: wgpu::BindingType::Texture {
                                multisampled: false,
                                view_dimension: wgpu::TextureViewDimension::D2,
                                sample_type: wgpu::TextureSampleType::Float { filterable: true },
                            },
                            count: None,
                        },
                        wgpu::BindGroupLayoutEntry {
                            binding: 1,
                            visibility: wgpu::ShaderStages::FRAGMENT,
                            ty: wgpu::BindingType::Sampler(wgpu::SamplerBindingType::Filtering),
                            count: None,
                        },
                    ],
                    label: Some("texture_bind_group_layout"),
                });

        let texture_bind_group = holder.device.create_bind_group(&wgpu::BindGroupDescriptor {
            layout: &texture_bind_group_layout,
            entries: &[
                wgpu::BindGroupEntry {
                    binding: 0,
                    resource: wgpu::BindingResource::TextureView(
                        &self.texture.as_ref().unwrap().view,
                    ),
                },
                wgpu::BindGroupEntry {
                    binding: 1,
                    resource: wgpu::BindingResource::Sampler(
                        &self.texture.as_ref().unwrap().sampler,
                    ),
                },
            ],
            label: Some("diffuse_bind_group"),
        });
        let shader_des = wgpu::ShaderModuleDescriptor {
            label: None,
            source: wgpu::ShaderSource::Wgsl(include_str!("default.wgsl").into()),
        };
        let shader = holder.device.create_shader_module(&shader_des);
        let render_pipeline_layout =
            holder
                .device
                .create_pipeline_layout(&wgpu::PipelineLayoutDescriptor {
                    label: Some("Render Pipeline Layout"),
                    bind_group_layouts: &[&texture_bind_group_layout],
                    push_constant_ranges: &[],
                });
        let render_pipeline =
            holder
                .device
                .create_render_pipeline(&wgpu::RenderPipelineDescriptor {
                    label: Some("Render Pipeline"),
                    layout: Some(&render_pipeline_layout),
                    vertex: wgpu::VertexState {
                        module: &shader,
                        entry_point: "vs_main",
                        buffers: &vec![Vertex::desc()],
                    },
                    fragment: Some(wgpu::FragmentState {
                        module: &shader,
                        entry_point: "fs_main",
                        targets: &[wgpu::ColorTargetState {
                            format: holder.config.format,
                            blend: Some(wgpu::BlendState {
                                color: wgpu::BlendComponent::OVER,
                                alpha: wgpu::BlendComponent::OVER,
                            }),
                            write_mask: wgpu::ColorWrites::ALL,
                        }],
                    }),
                    primitive: wgpu::PrimitiveState {
                        topology: wgpu::PrimitiveTopology::TriangleList,
                        strip_index_format: None,
                        front_face: wgpu::FrontFace::Ccw,
                        cull_mode: Some(wgpu::Face::Back),
                        // Setting this to anything other than Fill requires Features::POLYGON_MODE_LINE
                        // or Features::POLYGON_MODE_POINT
                        polygon_mode: wgpu::PolygonMode::Fill,
                        // Requires Features::DEPTH_CLIP_CONTROL
                        unclipped_depth: false,
                        // Requires Features::CONSERVATIVE_RASTERIZATION
                        conservative: false,
                    },
                    depth_stencil: None,
                    multisample: wgpu::MultisampleState {
                        count: 1,
                        mask: !0,
                        alpha_to_coverage_enabled: false,
                    },
                    // If the pipeline will be used with a multiview render pass, this
                    // indicates how many array layers the attachments will have.
                    multiview: None,
                });
        {
            let mut render_pass = encoder.begin_render_pass(&wgpu::RenderPassDescriptor {
                label: Some("Render Pass"),
                color_attachments: &[wgpu::RenderPassColorAttachment {
                    view: &output,
                    resolve_target: None,
                    ops: wgpu::Operations {
                        load: wgpu::LoadOp::Load,
                        store: true,
                    },
                }],
                depth_stencil_attachment: None,
            });
            render_pass.set_pipeline(&render_pipeline);
            render_pass.set_bind_group(0, &texture_bind_group, &[]);
            render_pass.set_vertex_buffer(0, vertex_buffer.slice(..));
            render_pass.set_index_buffer(index_buffer.slice(..), wgpu::IndexFormat::Uint16);
            render_pass.draw_indexed(0..INDICES.len() as u32, 0, 0..1);
        }

        holder.queue.submit(std::iter::once(encoder.finish()));
    }

    pub fn copy_for_quadtree(&self) -> ImageElement {
        ImageElement {
            id: self.id,
            texture: None,
            file_path: "".to_string(),
            rect: self.rect,
        }
    }
}
