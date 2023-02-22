#include <memory>
#include <string>
#include "Macros.hpp"
#include "CanvasRenderingContextBase.hpp"

class Canvas {
public:
    Canvas(int width, int height);

    ~Canvas();

    std::shared_ptr<CanvasRenderingContextBase> getContext(std::string typeName);

private:
    int mWidth;
    int mHeight;
    std::shared_ptr<CanvasRenderingContextBase> mContextSkia;
};