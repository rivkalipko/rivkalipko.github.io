#!/usr/bin/env ruby

require "json"
require "nokogiri"

input_dir = ARGV.fetch(0)
output_path = ARGV.fetch(1)

entries = Dir.glob(File.join(input_dir, "*.html")).sort.map do |path|
  doc = Nokogiri::HTML(File.read(path))
  slug = File.basename(path, ".html")
  title = doc.at_css("h1.entry-title")&.text&.strip || slug.tr("-", " ")
  body = doc.at_css(".nv-content-wrap.entry-content")
  body&.css(".sfsiaftrpstwpr, .sfsi_plus_Sicons")&.remove

  {
    "slug" => slug,
    "title" => title,
    "description" => body ? body.inner_html.strip : ""
  }
end

File.write(output_path, JSON.pretty_generate(entries) + "\n")
