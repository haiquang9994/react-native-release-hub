require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))

Pod::Spec.new do |s|
  s.name         = "react-native-release-hub"
  s.version      = package["version"]
  s.summary      = package["description"]
  s.homepage     = "https://github.com/haiquang9994/react-native-release-hub"
  s.license      = "MIT"
  s.authors      = { "ReleaseHub Team" => "support@releasehub.com" }
  s.platforms    = { :ios => "12.0" }
  s.source       = { :git => "https://github.com/haiquang9994/react-native-release-hub.git", :tag => "#{s.version}" }

  s.source_files = "ios/**/*.{h,m,mm}"
  s.requires_arc = true

  s.dependency "React-Core"
end
